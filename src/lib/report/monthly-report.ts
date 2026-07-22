import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type ReportView = "cashflow" | "normalized";

export type DeltaReason =
  | "match"
  | "new"
  | "unconfirmed"
  | "waived"
  | "amount_change"
  | "fx";

export const REASON_LABEL: Record<DeltaReason, string> = {
  match: "Совпадает",
  new: "Новый / вне плана",
  unconfirmed: "Не подтверждено",
  waived: "Списания не было",
  amount_change: "Изменение суммы/мест",
  fx: "Курсовая разница",
};

export type ServiceReportRow = {
  serviceId: string;
  name: string;
  currency: string;
  category: string;
  owner: string;
  plan: number;
  fact: number;
  delta: number;
  reason: DeltaReason;
};

export type SliceRow = { name: string; plan: number; fact: number; delta: number };

export type MonthlyReport = {
  base: string;
  year: number;
  month0: number;
  view: ReportView;
  hasSnapshot: boolean;
  totals: { plan: number; fact: number; delta: number; pct: number };
  services: ServiceReportRow[];
  byCategory: SliceRow[];
  byOwner: SliceRow[];
  events: string[];
};

const D = Prisma.Decimal;

function ownerName(u: { name: string | null; email: string | null } | null): string {
  return u?.name ?? u?.email ?? "—";
}

export async function getMonthlyReport(
  year: number,
  month0: number,
  view: ReportView = "cashflow"
): Promise<MonthlyReport> {
  const settings = await prisma.setting.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
  const base = settings.baseCurrency;

  const monthStart = new Date(Date.UTC(year, month0, 1));
  const nextMonth = new Date(Date.UTC(year, month0 + 1, 1));

  const [snapshot, payments, newServices, seatsAdded, seatsClosed, priceAudits] =
    await Promise.all([
      prisma.planSnapshot.findUnique({
        where: { month: monthStart },
        include: {
          lines: {
            include: {
              service: { include: { category: true, owner: true } },
            },
          },
        },
      }),
      prisma.payment.findMany({
        where: { paidAt: { gte: monthStart, lt: nextMonth } },
        include: { service: { include: { category: true, owner: true } } },
      }),
      prisma.service.findMany({
        where: { createdAt: { gte: monthStart, lt: nextMonth } },
        select: { name: true },
      }),
      prisma.seat.count({
        where: { startedAt: { gte: monthStart, lt: nextMonth } },
      }),
      prisma.seat.count({
        where: { endedAt: { gte: monthStart, lt: nextMonth } },
      }),
      prisma.auditLog.findMany({
        where: {
          entity: "Service",
          action: "update",
          ts: { gte: monthStart, lt: nextMonth },
        },
        select: { entityId: true, diff: true },
      }),
    ]);

  // Множитель нормализации: yearly / 12 в нормализованном представлении.
  const factor = (billingCycle: string) =>
    view === "normalized" && billingCycle === "yearly" ? new D(1).div(12) : new D(1);

  type Agg = {
    name: string;
    currency: string;
    category: string;
    owner: string;
    billingCycle: string;
    createdAt: Date;
    plan: Prisma.Decimal;
    fact: Prisma.Decimal;
    planStatus: string | null;
  };
  const map = new Map<string, Agg>();

  const ensure = (
    serviceId: string,
    svc: {
      name: string;
      currency: string;
      billingCycle: string;
      createdAt: Date;
      category: { name: string } | null;
      owner: { name: string | null; email: string | null };
    }
  ): Agg => {
    let a = map.get(serviceId);
    if (!a) {
      a = {
        name: svc.name,
        currency: svc.currency,
        category: svc.category?.name ?? "Без категории",
        owner: ownerName(svc.owner),
        billingCycle: svc.billingCycle,
        createdAt: svc.createdAt,
        plan: new D(0),
        fact: new D(0),
        planStatus: null,
      };
      map.set(serviceId, a);
    }
    return a;
  };

  for (const line of snapshot?.lines ?? []) {
    const a = ensure(line.serviceId, line.service);
    a.plan = a.plan.add(new D(line.amountBase).mul(factor(line.service.billingCycle)));
    a.planStatus = line.status;
  }
  for (const p of payments) {
    const a = ensure(p.serviceId, p.service);
    a.fact = a.fact.add(new D(p.amountBase).mul(factor(p.service.billingCycle)));
  }

  const priceChangedIds = new Set(
    priceAudits
      .filter((a) => {
        const diff = a.diff as Record<string, unknown> | null;
        return (
          diff && (("price" in diff) || ("seatPriceDefault" in diff))
        );
      })
      .map((a) => a.entityId)
  );

  const services: ServiceReportRow[] = [];
  for (const [serviceId, a] of map.entries()) {
    const plan = a.plan.toNumber();
    const fact = a.fact.toNumber();
    const delta = Math.round((fact - plan) * 100) / 100;

    let reason: DeltaReason;
    if (a.planStatus === "waived") reason = "waived";
    else if (a.planStatus && fact === 0) reason = "unconfirmed";
    else if (!a.planStatus && fact > 0) reason = "new";
    else if (Math.abs(delta) < 0.01) reason = "match";
    else if (a.currency !== base && !priceChangedIds.has(serviceId)) reason = "fx";
    else reason = "amount_change";

    services.push({
      serviceId,
      name: a.name,
      currency: a.currency,
      category: a.category,
      owner: a.owner,
      plan: Math.round(plan * 100) / 100,
      fact: Math.round(fact * 100) / 100,
      delta,
      reason,
    });
  }
  services.sort((x, y) => y.fact - x.fact || y.plan - x.plan);

  const sumBy = (key: "category" | "owner"): SliceRow[] => {
    const m = new Map<string, { plan: number; fact: number }>();
    for (const s of services) {
      const k = s[key];
      const prev = m.get(k) ?? { plan: 0, fact: 0 };
      m.set(k, { plan: prev.plan + s.plan, fact: prev.fact + s.fact });
    }
    return [...m.entries()]
      .map(([name, v]) => ({
        name,
        plan: Math.round(v.plan * 100) / 100,
        fact: Math.round(v.fact * 100) / 100,
        delta: Math.round((v.fact - v.plan) * 100) / 100,
      }))
      .sort((a, b) => b.fact - a.fact);
  };

  const planTotal = services.reduce((s, x) => s + x.plan, 0);
  const factTotal = services.reduce((s, x) => s + x.fact, 0);
  const delta = Math.round((factTotal - planTotal) * 100) / 100;
  const pct = planTotal > 0 ? Math.round((delta / planTotal) * 1000) / 10 : 0;

  const events: string[] = [];
  if (newServices.length > 0)
    events.push(
      `Новые подписки: ${newServices.map((s) => s.name).join(", ")}`
    );
  if (seatsAdded > 0) events.push(`Добавлено мест: ${seatsAdded}`);
  if (seatsClosed > 0) events.push(`Закрыто мест: ${seatsClosed}`);
  if (priceChangedIds.size > 0)
    events.push(`Изменений цен сервисов: ${priceChangedIds.size}`);

  return {
    base,
    year,
    month0,
    view,
    hasSnapshot: Boolean(snapshot),
    totals: {
      plan: Math.round(planTotal * 100) / 100,
      fact: Math.round(factTotal * 100) / 100,
      delta,
      pct,
    },
    services,
    byCategory: sumBy("category"),
    byOwner: sumBy("owner"),
    events,
  };
}
