import { describe, it, expect } from "vitest";
import { findRate, convert, type RateRecord } from "@/lib/calc/fx";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

const rates: RateRecord[] = [
  { date: d("2026-01-01"), from: "EUR", to: "USD", rate: 1.05 },
  { date: d("2026-02-01"), from: "EUR", to: "USD", rate: 1.08 },
  { date: d("2026-03-01"), from: "EUR", to: "USD", rate: 1.1 },
  { date: d("2026-02-01"), from: "GBP", to: "USD", rate: 1.27 },
];

describe("findRate (§3.9)", () => {
  it("одинаковая валюта → 1", () => {
    expect(findRate(rates, "USD", "USD", d("2026-02-15"))!.toString()).toBe("1");
  });

  it("точный курс на дату", () => {
    expect(findRate(rates, "EUR", "USD", d("2026-02-01"))!.toString()).toBe("1.08");
  });

  it("нет курса на дату → последний известный ДО неё", () => {
    // на 2026-02-15 нет записи → берётся февральская (2026-02-01) = 1.08
    expect(findRate(rates, "EUR", "USD", d("2026-02-15"))!.toString()).toBe("1.08");
    // на 2026-01-20 → январская 1.05
    expect(findRate(rates, "EUR", "USD", d("2026-01-20"))!.toString()).toBe("1.05");
  });

  it("дата раньше всех известных курсов → null", () => {
    expect(findRate(rates, "EUR", "USD", d("2025-12-31"))).toBeNull();
  });

  it("обратный курс через инверсию (USD→EUR)", () => {
    // прямого USD→EUR нет, инверсия от EUR→USD (1.08 на 2026-02-01): 1/1.08
    const r = findRate(rates, "USD", "EUR", d("2026-02-10"))!;
    expect(r.toDP(4).toString()).toBe("0.9259");
  });

  it("неизвестная валюта → null", () => {
    expect(findRate(rates, "JPY", "USD", d("2026-02-10"))).toBeNull();
  });
});

describe("convert", () => {
  it("критерий №5: EUR→USD по курсу даты", () => {
    // 100 EUR на 2026-03-10 → курс 1.1 → 110 USD
    expect(convert(100, "EUR", "USD", d("2026-03-10"), rates)!.toString()).toBe("110");
  });

  it("нет курса → null", () => {
    expect(convert(100, "EUR", "USD", d("2025-01-01"), rates)).toBeNull();
  });
});
