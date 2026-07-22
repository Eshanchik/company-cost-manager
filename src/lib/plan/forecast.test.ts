import { describe, it, expect } from "vitest";
import { sumRemainingBase } from "@/lib/plan/forecast";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

describe("sumRemainingBase (прогноз до конца месяца)", () => {
  const lines = [
    { expectedDate: d("2026-07-03"), amountBase: 100 },
    { expectedDate: d("2026-07-15"), amountBase: 50 },
    { expectedDate: d("2026-07-28"), amountBase: 25 },
  ];

  it("суммирует списания с датой ≥ asOf", () => {
    // на 10-е: остаются 15-е и 28-е → 75
    expect(sumRemainingBase(lines, d("2026-07-10")).toString()).toBe("75");
  });

  it("включает списание в тот же день", () => {
    // на 15-е: 15-е и 28-е → 75
    expect(sumRemainingBase(lines, d("2026-07-15")).toString()).toBe("75");
  });

  it("до начала месяца → вся сумма", () => {
    expect(sumRemainingBase(lines, d("2026-07-01")).toString()).toBe("175");
  });

  it("после последнего списания → 0", () => {
    expect(sumRemainingBase(lines, d("2026-07-29")).toString()).toBe("0");
  });
});
