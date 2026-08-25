import { isPrepaidFor } from "@/lib/calc/plan";

const DAY_MS = 86_400_000;

export type RenewalCandidate = {
  id: string;
  name: string;
  billingCycle: string;
  renewalDate: Date | null;
  cancellationNoticeDays: number;
  prepaidUntil?: Date | null;
};

export type RenewalInWindow = {
  serviceId: string;
  name: string;
  renewalDate: Date;
  daysLeft: number;
};

function atUtcDay(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Годовые подписки в «окне решения» (§4.4):
 * renewal_date − cancellation_notice_days ≤ сегодня ≤ renewal_date.
 * Предоплаченные за дату продления не тревожим — решение уже оплачено.
 * Чистая функция: используется и дашбордом, и REST/MCP (needs_attention).
 */
export function renewalsInWindow(
  services: RenewalCandidate[],
  asOf: Date
): RenewalInWindow[] {
  const today = atUtcDay(asOf);

  return services
    .filter((s) => s.billingCycle === "yearly" && s.renewalDate)
    .filter((s) => !isPrepaidFor(s.prepaidUntil, s.renewalDate!))
    .map((s) => {
      const renewal = s.renewalDate!;
      const windowStart = renewal.getTime() - s.cancellationNoticeDays * DAY_MS;
      return {
        service: s,
        renewal,
        inWindow: windowStart <= today && today <= renewal.getTime(),
        daysLeft: Math.ceil((renewal.getTime() - today) / DAY_MS),
      };
    })
    .filter((x) => x.inWindow)
    .map((x) => ({
      serviceId: x.service.id,
      name: x.service.name,
      renewalDate: x.renewal,
      daysLeft: x.daysLeft,
    }))
    .sort((a, b) => a.daysLeft - b.daysLeft);
}
