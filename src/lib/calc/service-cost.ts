import { Prisma, type BillingModel, type BillingCycle } from "@prisma/client";

const D = Prisma.Decimal;
type Dec = Prisma.Decimal;

export type SeatLike = { seatPrice: Prisma.Decimal | number | string };

export type ServiceCostInput = {
  billingModel: BillingModel;
  price: Prisma.Decimal | number | string;
  seats: SeatLike[];
};

/** Сумма цен активных мест. */
export function seatsTotal(seats: SeatLike[]): Dec {
  return seats.reduce((acc, s) => acc.add(new D(s.seatPrice)), new D(0));
}

/**
 * Стоимость сервиса за один биллинговый цикл в его валюте (§4.1):
 * - fixed:    price
 * - per_seat: Σ мест
 * - hybrid:   price + Σ мест
 * Для monthly это месячная сумма, для yearly — годовая.
 */
export function serviceCycleCost(input: ServiceCostInput): Dec {
  const price = new D(input.price);
  switch (input.billingModel) {
    case "fixed":
      return price;
    case "per_seat":
      return seatsTotal(input.seats);
    case "hybrid":
      return price.add(seatsTotal(input.seats));
    default: {
      const _exhaustive: never = input.billingModel;
      return _exhaustive;
    }
  }
}

/**
 * Нормализация к месячной стоимости (run-rate, §4.1):
 * monthly → как есть; yearly → сумма / 12.
 */
export function normalizeToMonthly(amount: Dec, cycle: BillingCycle): Dec {
  return cycle === "yearly" ? amount.div(12) : amount;
}

/** Нормализованная месячная стоимость сервиса (run-rate). */
export function serviceMonthlyRunRate(
  input: ServiceCostInput & { billingCycle: BillingCycle }
): Dec {
  return normalizeToMonthly(serviceCycleCost(input), input.billingCycle);
}
