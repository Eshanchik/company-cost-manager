import type { BillingCycle } from "@prisma/client";

/** Число дней в месяце (UTC). */
export function daysInMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

/**
 * Дата в указанном месяце с днём `day`, но не больше последнего дня месяца
 * (§4.2: billing_day 31 в феврале → 28/29). Возвращает UTC-полночь.
 */
export function clampToMonth(year: number, month0: number, day: number): Date {
  const last = daysInMonth(year, month0);
  return new Date(Date.UTC(year, month0, Math.min(day, last)));
}

/** Ближайшая дата ежемесячного списания в `billingDay` начиная с `from` (вкл.). */
export function nextMonthlyPayment(billingDay: number, from: Date): Date {
  const y = from.getUTCFullYear();
  const m = from.getUTCMonth();
  const candidate = clampToMonth(y, m, billingDay);
  if (candidate.getTime() >= atMidnight(from).getTime()) return candidate;
  return clampToMonth(y, m + 1, billingDay);
}

/** Ближайшая годовщина `renewalDate` начиная с `from` (вкл.). */
export function nextYearlyPayment(renewalDate: Date, from: Date): Date {
  const day = renewalDate.getUTCDate();
  const month0 = renewalDate.getUTCMonth();
  const y = from.getUTCFullYear();
  const candidate = clampToMonth(y, month0, day);
  if (candidate.getTime() >= atMidnight(from).getTime()) return candidate;
  return clampToMonth(y + 1, month0, day);
}

export function computeNextPaymentDate(
  input: {
    billingCycle: BillingCycle;
    billingDay: number | null;
    renewalDate: Date | null;
    /** «Оплачено вперёд до» — следующий платёж не раньше следующего дня. */
    prepaidUntil?: Date | null;
  },
  from: Date
): Date | null {
  // Если сервис проплачен вперёд, ищем ближайшее списание ПОСЛЕ этой даты.
  const searchFrom = input.prepaidUntil
    ? new Date(
        Math.max(
          atMidnight(from).getTime(),
          atMidnight(input.prepaidUntil).getTime() + 86400000
        )
      )
    : from;

  if (input.billingCycle === "monthly" && input.billingDay != null) {
    return nextMonthlyPayment(input.billingDay, searchFrom);
  }
  if (input.billingCycle === "yearly" && input.renewalDate) {
    return nextYearlyPayment(input.renewalDate, searchFrom);
  }
  return null;
}

function atMidnight(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
}
