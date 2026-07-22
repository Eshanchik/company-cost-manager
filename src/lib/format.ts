import { Prisma } from "@prisma/client";

type Money = Prisma.Decimal | number | string;

function toNumber(v: Money): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v);
  return v.toNumber();
}

/** Денежная сумма в формате ru-RU с символом валюты. */
export function formatMoney(amount: Money, currency: string): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(toNumber(amount));
}

/** Число с разделителями тысяч (ru-RU), без валюты. */
export function formatNumber(amount: Money, fractionDigits = 2): string {
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  }).format(toNumber(amount));
}

/** Дата в формате DD.MM.YYYY (в UTC — даты хранятся как календарные). */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${dd}.${mm}.${yyyy}`;
}
