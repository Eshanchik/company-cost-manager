import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { buildMonthlyPlan, type PlanServiceInput } from "@/lib/calc/plan";
import { convert, type RateRecord } from "@/lib/calc/fx";

const D = Prisma.Decimal;

type RemainingLine = {
  expectedDate: Date;
  amountBase: Prisma.Decimal | number | string;
};

function atDay(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Сумма ожидаемых списаний с датой ≥ `asOf` (по дню) — «прогноз до конца
 * месяца» по строкам плана в базовой валюте. Чистая функция.
 */
export function sumRemainingBase(
  lines: RemainingLine[],
  asOf: Date
): Prisma.Decimal {
  const from = atDay(asOf);
  return lines.reduce(
    (acc, l) =>
      atDay(l.expectedDate) >= from ? acc.add(new D(l.amountBase)) : acc,
    new D(0)
  );
}

/**
 * «Прогноз до конца месяца» по живым данным (§3.8): собирает план текущего
 * месяца из актуальных сервисов/мест и суммирует оставшиеся списания в базовой
 * валюте (по курсу на `asOf`).
 */
export async function forecastToEndOfMonth(asOf: Date = new Date()): Promise<{
  base: string;
  remaining: Prisma.Decimal;
  monthTotal: Prisma.Decimal;
}> {
  const year = asOf.getUTCFullYear();
  const month0 = asOf.getUTCMonth();

  const settings = await prisma.setting.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
  const base = settings.baseCurrency;

  const [services, rates] = await Promise.all([
    prisma.service.findMany({
      where: { status: "active" },
      include: { seats: { where: { endedAt: null } } },
    }),
    prisma.fxRate.findMany(),
  ]);

  const rateRecords: RateRecord[] = rates.map((r) => ({
    date: r.date,
    from: r.from,
    to: r.to,
    rate: r.rate,
  }));

  const planInputs: PlanServiceInput[] = services.map((s) => ({
    id: s.id,
    status: s.status,
    billingModel: s.billingModel,
    billingCycle: s.billingCycle,
    billingDay: s.billingDay,
    renewalDate: s.renewalDate,
    price: s.price,
    currency: s.currency,
    seats: s.seats,
  }));

  const drafts = buildMonthlyPlan(planInputs, year, month0);
  const lines = drafts.map((d) => ({
    expectedDate: d.expectedDate,
    amountBase:
      convert(d.expectedAmount, d.currency, base, asOf, rateRecords) ??
      d.expectedAmount,
  }));

  const monthTotal = lines.reduce((acc, l) => acc.add(new D(l.amountBase)), new D(0));
  const remaining = sumRemainingBase(lines, asOf);

  return { base, remaining, monthTotal };
}
