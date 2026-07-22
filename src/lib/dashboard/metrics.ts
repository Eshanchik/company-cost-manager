import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { serviceMonthlyRunRate } from "@/lib/calc/service-cost";
import { convert, type RateRecord } from "@/lib/calc/fx";
import { forecastToEndOfMonth } from "@/lib/plan/forecast";
import { getExpectedCharges, type ExpectedCharge } from "@/lib/plan/expected-charges";

const D = Prisma.Decimal;

export type RenewalWindow = {
  serviceId: string;
  name: string;
  renewalDate: string;
  daysLeft: number;
};

export type MonthPoint = { month: string; plan: number; fact: number };
export type CategorySlice = { name: string; color: string; value: number };
export type TopService = { name: string; value: number };

export type DashboardMetrics = {
  base: string;
  runRateMonthly: number;
  activeServices: number;
  activeSeats: number;
  monthPlan: number;
  monthFact: number;
  progressPct: number;
  forecastRemaining: number;
  forecastMonthTotal: number;
  overdue: ExpectedCharge[];
  renewals: RenewalWindow[];
  planFact12: MonthPoint[];
  byCategory: CategorySlice[];
  top5: TopService[];
};

function ymKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function toBase(
  amount: Prisma.Decimal | number | string,
  currency: string,
  base: string,
  rates: RateRecord[],
  asOf: Date
): Prisma.Decimal {
  return convert(amount, currency, base, asOf, rates) ?? new D(amount);
}

export async function getDashboardMetrics(
  asOf: Date = new Date()
): Promise<DashboardMetrics> {
  const settings = await prisma.setting.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
  const base = settings.baseCurrency;

  const [services, ratesRaw, forecast, expected] = await Promise.all([
    prisma.service.findMany({
      where: { status: "active" },
      include: {
        category: true,
        seats: { where: { endedAt: null } },
      },
    }),
    prisma.fxRate.findMany(),
    forecastToEndOfMonth(asOf),
    getExpectedCharges(asOf),
  ]);

  const rates: RateRecord[] = ratesRaw.map((r) => ({
    date: r.date,
    from: r.from,
    to: r.to,
    rate: r.rate,
  }));

  // Run-rate/мес в базовой валюте + топ-5 + разбивка по категориям.
  let runRate = new D(0);
  let activeSeats = 0;
  const catMap = new Map<string, { color: string; value: Prisma.Decimal }>();
  const serviceValues: TopService[] = [];

  for (const s of services) {
    activeSeats += s.seats.length;
    const rrCurrency = serviceMonthlyRunRate({
      billingModel: s.billingModel,
      billingCycle: s.billingCycle,
      price: s.price,
      seats: s.seats,
    });
    const rrBase = toBase(rrCurrency, s.currency, base, rates, asOf);
    runRate = runRate.add(rrBase);
    serviceValues.push({ name: s.name, value: rrBase.toNumber() });

    const catName = s.category?.name ?? "Без категории";
    const catColor = s.category?.color ?? "#94a3b8";
    const prev = catMap.get(catName);
    catMap.set(catName, {
      color: catColor,
      value: (prev?.value ?? new D(0)).add(rrBase),
    });
  }

  const byCategory: CategorySlice[] = [...catMap.entries()]
    .map(([name, v]) => ({ name, color: v.color, value: v.value.toNumber() }))
    .sort((a, b) => b.value - a.value);

  const top5 = serviceValues
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  // Факт/план текущего месяца.
  const monthStart = new Date(
    Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), 1)
  );
  const nextMonth = new Date(
    Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() + 1, 1)
  );

  const [monthPayments, currentSnapshot] = await Promise.all([
    prisma.payment.findMany({
      where: { paidAt: { gte: monthStart, lt: nextMonth } },
      select: { amountBase: true },
    }),
    prisma.planSnapshot.findUnique({
      where: { month: monthStart },
      include: { lines: { select: { amountBase: true } } },
    }),
  ]);

  const monthFact = monthPayments
    .reduce((acc, p) => acc.add(p.amountBase), new D(0))
    .toNumber();
  const monthPlan = (currentSnapshot?.lines ?? [])
    .reduce((acc, l) => acc.add(l.amountBase), new D(0))
    .toNumber();
  const progressPct =
    monthPlan > 0 ? Math.round((monthFact / monthPlan) * 100) : 0;

  // 12 месяцев план/факт.
  const start12 = new Date(
    Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() - 11, 1)
  );
  const [snaps12, pays12] = await Promise.all([
    prisma.planSnapshot.findMany({
      where: { month: { gte: start12 } },
      include: { lines: { select: { amountBase: true } } },
    }),
    prisma.payment.findMany({
      where: { paidAt: { gte: start12 } },
      select: { paidAt: true, amountBase: true },
    }),
  ]);

  const planByMonth = new Map<string, number>();
  for (const s of snaps12) {
    planByMonth.set(
      ymKey(s.month),
      s.lines.reduce((acc, l) => acc + l.amountBase.toNumber(), 0)
    );
  }
  const factByMonth = new Map<string, number>();
  for (const p of pays12) {
    const k = ymKey(p.paidAt);
    factByMonth.set(k, (factByMonth.get(k) ?? 0) + p.amountBase.toNumber());
  }

  const planFact12: MonthPoint[] = [];
  for (let i = 0; i < 12; i++) {
    const dt = new Date(
      Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() - 11 + i, 1)
    );
    const k = ymKey(dt);
    planFact12.push({
      month: k,
      plan: Math.round((planByMonth.get(k) ?? 0) * 100) / 100,
      fact: Math.round((factByMonth.get(k) ?? 0) * 100) / 100,
    });
  }

  // «Требует внимания»: годовые в окне решения (§4.4).
  const asOfDay = Date.UTC(
    asOf.getUTCFullYear(),
    asOf.getUTCMonth(),
    asOf.getUTCDate()
  );
  const renewals: RenewalWindow[] = services
    .filter((s) => s.billingCycle === "yearly" && s.renewalDate)
    .map((s) => {
      const renewal = s.renewalDate!;
      const windowStart =
        renewal.getTime() - s.cancellationNoticeDays * 86400000;
      const inWindow = windowStart <= asOfDay && asOfDay <= renewal.getTime();
      const daysLeft = Math.ceil((renewal.getTime() - asOfDay) / 86400000);
      return { service: s, renewal, inWindow, daysLeft };
    })
    .filter((x) => x.inWindow)
    .map((x) => ({
      serviceId: x.service.id,
      name: x.service.name,
      renewalDate: x.renewal.toISOString(),
      daysLeft: x.daysLeft,
    }))
    .sort((a, b) => a.daysLeft - b.daysLeft);

  return {
    base,
    runRateMonthly: runRate.toNumber(),
    activeServices: services.length,
    activeSeats,
    monthPlan,
    monthFact,
    progressPct,
    forecastRemaining: forecast.remaining.toNumber(),
    forecastMonthTotal: forecast.monthTotal.toNumber(),
    overdue: expected.charges.filter((c) => c.overdue),
    renewals,
    planFact12,
    byCategory,
    top5,
  };
}
