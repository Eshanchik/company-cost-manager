import { describe, it, expect } from "vitest";
import { renewalsInWindow, type RenewalCandidate } from "@/lib/calc/renewals";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const svc = (over: Partial<RenewalCandidate> = {}): RenewalCandidate => ({
  id: "s1",
  name: "Ahrefs",
  billingCycle: "yearly",
  renewalDate: d("2026-09-15"),
  cancellationNoticeDays: 30,
  ...over,
});

describe("renewalsInWindow (§4.4)", () => {
  it("внутри окна решения — попадает", () => {
    const r = renewalsInWindow([svc()], d("2026-09-01"));
    expect(r).toHaveLength(1);
    expect(r[0]!.daysLeft).toBe(14);
  });

  it("до окна — не попадает", () => {
    expect(renewalsInWindow([svc()], d("2026-08-01"))).toHaveLength(0);
  });

  it("после даты продления — не попадает", () => {
    expect(renewalsInWindow([svc()], d("2026-09-16"))).toHaveLength(0);
  });

  it("границы окна включительно", () => {
    expect(renewalsInWindow([svc()], d("2026-08-16"))).toHaveLength(1);
    expect(renewalsInWindow([svc()], d("2026-09-15"))).toHaveLength(1);
  });

  it("monthly игнорируется", () => {
    expect(
      renewalsInWindow([svc({ billingCycle: "monthly" })], d("2026-09-01"))
    ).toHaveLength(0);
  });

  it("оплачено вперёд за дату продления — не тревожим", () => {
    expect(
      renewalsInWindow([svc({ prepaidUntil: d("2026-12-31") })], d("2026-09-01"))
    ).toHaveLength(0);
  });

  it("предоплата заканчивается ДО продления — тревожим", () => {
    expect(
      renewalsInWindow([svc({ prepaidUntil: d("2026-09-01") })], d("2026-09-05"))
    ).toHaveLength(1);
  });

  it("сортировка: ближайшее продление первым", () => {
    const r = renewalsInWindow(
      [
        svc({ id: "late", renewalDate: d("2026-09-20") }),
        svc({ id: "soon", renewalDate: d("2026-09-10") }),
      ],
      d("2026-09-05")
    );
    expect(r.map((x) => x.serviceId)).toEqual(["soon", "late"]);
  });
});
