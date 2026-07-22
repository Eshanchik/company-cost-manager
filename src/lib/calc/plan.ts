import { Prisma, type BillingModel, type BillingCycle } from "@prisma/client";

import { clampToMonth } from "@/lib/calc/dates";
import { serviceCycleCost, seatsTotal } from "@/lib/calc/service-cost";

type Dec = Prisma.Decimal;

export type PlanServiceInput = {
  id: string;
  status: string;
  billingModel: BillingModel;
  billingCycle: BillingCycle;
  billingDay: number | null;
  renewalDate: Date | null;
  price: Prisma.Decimal | number | string;
  currency: string;
  seats: { seatPrice: Prisma.Decimal | number | string }[];
};

export type PlanBreakdown = {
  fixed: string;
  seatsCount: number;
  seatsAmount: string;
};

export type PlanLineDraft = {
  serviceId: string;
  expectedDate: Date;
  expectedAmount: Dec;
  currency: string;
  breakdown: PlanBreakdown;
};

/**
 * Дата ожидаемого списания сервиса в месяце (year, month0), либо null, если в
 * этом месяце списания нет (§4.2):
 * - monthly: `billingDay`, но не больше числа дней месяца (31 в феврале → 28/29);
 * - yearly: только в месяц `renewalDate`, в день продления.
 */
export function expectedDateForMonth(
  service: Pick<
    PlanServiceInput,
    "billingCycle" | "billingDay" | "renewalDate"
  >,
  year: number,
  month0: number
): Date | null {
  if (service.billingCycle === "monthly") {
    if (service.billingDay == null) return null;
    return clampToMonth(year, month0, service.billingDay);
  }
  // yearly
  if (!service.renewalDate) return null;
  if (service.renewalDate.getUTCMonth() !== month0) return null;
  return clampToMonth(year, month0, service.renewalDate.getUTCDate());
}

/**
 * Строка плана для сервиса в месяце (year, month0) или null, если сервис не
 * попадает в план (не active, либо нет списания в этом месяце).
 * Сумма строки = стоимость сервиса за цикл (§4.1) в его валюте; для yearly это
 * полный годовой платёж в месяц продления (кэш-флоу).
 */
export function buildPlanLine(
  service: PlanServiceInput,
  year: number,
  month0: number
): PlanLineDraft | null {
  if (service.status !== "active") return null;

  const expectedDate = expectedDateForMonth(service, year, month0);
  if (!expectedDate) return null;

  const expectedAmount = serviceCycleCost({
    billingModel: service.billingModel,
    price: service.price,
    seats: service.seats,
  });

  const fixed =
    service.billingModel === "per_seat"
      ? new Prisma.Decimal(0)
      : new Prisma.Decimal(service.price);
  const seatsAmount =
    service.billingModel === "fixed"
      ? new Prisma.Decimal(0)
      : seatsTotal(service.seats);

  return {
    serviceId: service.id,
    expectedDate,
    expectedAmount,
    currency: service.currency,
    breakdown: {
      fixed: fixed.toString(),
      seatsCount: service.billingModel === "fixed" ? 0 : service.seats.length,
      seatsAmount: seatsAmount.toString(),
    },
  };
}

/** План месяца: строки по всем сервисам, у которых есть списание в (year, month0). */
export function buildMonthlyPlan(
  services: PlanServiceInput[],
  year: number,
  month0: number
): PlanLineDraft[] {
  return services
    .map((s) => buildPlanLine(s, year, month0))
    .filter((l): l is PlanLineDraft => l !== null);
}
