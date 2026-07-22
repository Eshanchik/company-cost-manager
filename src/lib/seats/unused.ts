import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { normalizeToMonthly } from "@/lib/calc/service-cost";

export type UnusedReason = "offboarded" | "idle";

export const UNUSED_REASON_LABEL: Record<UnusedReason, string> = {
  offboarded: "Сотрудник офбордингнут",
  idle: "Нет активности",
};

/**
 * Классификация активного места как «неиспользуемого» (без внешних API):
 * - `offboarded`: сотрудник offboarded, а место всё ещё активно (деньги впустую);
 * - `idle`: отмеченная «последняя активность» старше порога.
 * Возвращает причину или null. Чистая функция.
 */
export function classifySeat(
  seat: {
    endedAt: Date | null;
    lastUsedAt: Date | null;
    employeeStatus: string;
  },
  thresholdDays: number,
  asOf: Date
): UnusedReason | null {
  if (seat.endedAt) return null; // закрытые не считаем
  if (seat.employeeStatus === "offboarded") return "offboarded";
  if (
    seat.lastUsedAt &&
    asOf.getTime() - seat.lastUsedAt.getTime() > thresholdDays * 86400000
  ) {
    return "idle";
  }
  return null;
}

export type UnusedSeat = {
  seatId: string;
  serviceId: string;
  serviceName: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  monthly: number;
  currency: string;
  reason: UnusedReason;
  lastUsedAt: string | null;
};

/** Активные места, помеченные как неиспользуемые (§Этап 3). */
export async function getUnusedSeats(
  asOf: Date = new Date()
): Promise<{ seats: UnusedSeat[]; thresholdDays: number }> {
  const settings = await prisma.setting.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
  const thresholdDays = settings.unusedSeatDays;

  const seats = await prisma.seat.findMany({
    where: { endedAt: null },
    include: {
      employee: true,
      service: { select: { name: true, billingCycle: true, currency: true } },
    },
  });

  const out: UnusedSeat[] = [];
  for (const s of seats) {
    const reason = classifySeat(
      {
        endedAt: s.endedAt,
        lastUsedAt: s.lastUsedAt,
        employeeStatus: s.employee.status,
      },
      thresholdDays,
      asOf
    );
    if (!reason) continue;
    out.push({
      seatId: s.id,
      serviceId: s.serviceId,
      serviceName: s.service.name,
      employeeId: s.employeeId,
      employeeName: s.employee.fullName,
      employeeEmail: s.employee.email,
      monthly: normalizeToMonthly(
        new Prisma.Decimal(s.seatPrice),
        s.service.billingCycle
      ).toNumber(),
      currency: s.service.currency,
      reason,
      lastUsedAt: s.lastUsedAt?.toISOString() ?? null,
    });
  }
  // Офбординг-места вперёд, затем по стоимости.
  out.sort(
    (a, b) =>
      (a.reason === b.reason ? 0 : a.reason === "offboarded" ? -1 : 1) ||
      b.monthly - a.monthly
  );
  return { seats: out, thresholdDays };
}
