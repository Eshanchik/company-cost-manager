import { Prisma } from "@prisma/client";

const D = Prisma.Decimal;
type Dec = Prisma.Decimal;

export type RateRecord = {
  date: Date;
  from: string;
  to: string;
  rate: Prisma.Decimal | number | string;
};

function atDay(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Курс `from → to` на дату `on` (§3.9): берётся последний известный курс с
 * датой ≤ `on`. Если прямого курса нет — пробуем обратный (1 / rate).
 * Одинаковая валюта → 1. Возвращает null, если курс найти невозможно.
 */
export function findRate(
  rates: RateRecord[],
  from: string,
  to: string,
  on: Date
): Dec | null {
  if (from === to) return new D(1);
  const onTs = atDay(on);

  const pickLatest = (f: string, t: string): RateRecord | null => {
    let best: RateRecord | null = null;
    for (const r of rates) {
      if (r.from !== f || r.to !== t) continue;
      if (atDay(r.date) > onTs) continue;
      if (!best || atDay(r.date) > atDay(best.date)) best = r;
    }
    return best;
  };

  const direct = pickLatest(from, to);
  if (direct) return new D(direct.rate);

  const inverse = pickLatest(to, from);
  if (inverse) return new D(1).div(new D(inverse.rate));

  return null;
}

/**
 * Пересчёт суммы из `from` в `to` на дату `on`. null, если курс недоступен.
 */
export function convert(
  amount: Prisma.Decimal | number | string,
  from: string,
  to: string,
  on: Date,
  rates: RateRecord[]
): Dec | null {
  const rate = findRate(rates, from, to, on);
  if (rate === null) return null;
  return new D(amount).mul(rate);
}
