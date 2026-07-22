import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { buildMonthlyPlan, type PlanServiceInput } from "@/lib/calc/plan";
import { convert, type RateRecord } from "@/lib/calc/fx";

export type SnapshotResult = {
  created: boolean;
  skipped?: boolean;
  snapshotId?: string;
  month: string; // YYYY-MM
  lines: number;
  reason?: string;
};

export function monthStart(year: number, month0: number): Date {
  return new Date(Date.UTC(year, month0, 1));
}

/**
 * Генерация план-снапшота месяца (§3.8).
 * - Берёт active-сервисы с активными местами, собирает план (§4.2).
 * - Сумма строки в валюте сервиса; `amountBase` — по курсу даты снапшота.
 * - Неизменяемость: если снапшот месяца уже есть и `force` не задан — не трогаем
 *   (план задним числом не меняется). `force` = ручная пересборка Admin'ом.
 */
export async function generateSnapshot(opts: {
  year: number;
  month0: number;
  asOf?: Date;
  force?: boolean;
}): Promise<SnapshotResult> {
  const { year, month0, force = false } = opts;
  const asOf = opts.asOf ?? new Date();
  const month = monthStart(year, month0);
  const monthLabel = `${year}-${String(month0 + 1).padStart(2, "0")}`;

  const existing = await prisma.planSnapshot.findUnique({ where: { month } });
  if (existing && !force) {
    return {
      created: false,
      skipped: true,
      month: monthLabel,
      lines: 0,
      reason: "снапшот уже существует (неизменяемость §3.8)",
    };
  }

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

  const snapshotId = await prisma.$transaction(async (tx) => {
    if (existing) {
      await tx.planSnapshot.delete({ where: { id: existing.id } });
    }
    const snapshot = await tx.planSnapshot.create({ data: { month } });

    for (const d of drafts) {
      const amountBase =
        convert(d.expectedAmount, d.currency, base, asOf, rateRecords) ??
        d.expectedAmount; // fallback 1:1, если курс недоступен
      await tx.planLine.create({
        data: {
          snapshotId: snapshot.id,
          serviceId: d.serviceId,
          expectedDate: d.expectedDate,
          expectedAmount: new Prisma.Decimal(d.expectedAmount),
          currency: d.currency,
          amountBase: new Prisma.Decimal(amountBase),
          breakdown: d.breakdown as unknown as Prisma.InputJsonValue,
          status: "expected",
        },
      });
    }
    return snapshot.id;
  });

  return {
    created: true,
    snapshotId,
    month: monthLabel,
    lines: drafts.length,
  };
}
