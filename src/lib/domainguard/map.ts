import { Prisma } from "@prisma/client";

import type { DgDomain } from "@/lib/domainguard/client";
import { computeNextPaymentDate } from "@/lib/calc/dates";

export const DG_SOURCE = "domainguard";

export type MappedDomain = {
  externalId: string;
  name: string;
  renewalDate: Date | null;
  /** null — цена в реестре не указана (в SubTrack не перетираем ручную). */
  price: Prisma.Decimal | null;
  currency: string;
  autoRenew: boolean;
  status: "active" | "archived";
  nextPaymentDate: Date | null;
};

/**
 * Домен реестра → поля SubTrack. Чистая функция (тестируется без сети/БД).
 *
 * Правила:
 * - `renewal_price = null` → цена НЕ известна: при создании ставим 0 и помечаем,
 *   при обновлении не трогаем (иначе затрём цену, введённую руками).
 * - `is_active = false` → сервис в архиве.
 * - `expiry_date` → дата продления (годовой цикл).
 */
export function mapDgDomain(dg: DgDomain, now: Date): MappedDomain {
  const renewalDate = dg.expiry_date ? new Date(dg.expiry_date) : null;
  const priceRaw = dg.renewal_price;
  const price =
    priceRaw !== null && priceRaw !== undefined && priceRaw !== ""
      ? new Prisma.Decimal(priceRaw)
      : null;

  return {
    externalId: String(dg.id),
    name: dg.fqdn.toLowerCase(),
    renewalDate,
    price,
    currency: dg.renewal_currency || "USD",
    autoRenew: Boolean(dg.auto_renew),
    status: dg.is_active ? "active" : "archived",
    nextPaymentDate: renewalDate
      ? computeNextPaymentDate(
          { billingCycle: "yearly", billingDay: null, renewalDate },
          now
        )
      : null,
  };
}

/** Отбор доменов нужных проектов (пустой список — берём все). */
export function filterByProjects(
  domains: DgDomain[],
  projectIds: number[]
): DgDomain[] {
  if (projectIds.length === 0) return domains;
  const set = new Set(projectIds);
  return domains.filter((d) => set.has(d.project_id));
}
