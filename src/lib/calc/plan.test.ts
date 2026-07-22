import { describe, it, expect } from "vitest";
import {
  expectedDateForMonth,
  buildPlanLine,
  buildMonthlyPlan,
  type PlanServiceInput,
} from "@/lib/calc/plan";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const iso = (date: Date) => date.toISOString().slice(0, 10);

const base: PlanServiceInput = {
  id: "s1",
  status: "active",
  billingModel: "per_seat",
  billingCycle: "monthly",
  billingDay: 15,
  renewalDate: null,
  price: 0,
  currency: "USD",
  seats: [{ seatPrice: 10 }, { seatPrice: 10 }, { seatPrice: 10 }],
};

describe("expectedDateForMonth — monthly, billing_day edge cases (§4.2, критерий №7)", () => {
  it("обычный день 15 в марте", () => {
    expect(iso(expectedDateForMonth({ billingCycle: "monthly", billingDay: 15, renewalDate: null }, 2026, 2)!)).toBe("2026-03-15");
  });

  it("billing_day 31 в феврале 2026 (не високосный) → 28.02", () => {
    expect(iso(expectedDateForMonth({ billingCycle: "monthly", billingDay: 31, renewalDate: null }, 2026, 1)!)).toBe("2026-02-28");
  });

  it("billing_day 29 в феврале 2028 (високосный) → 29.02", () => {
    expect(iso(expectedDateForMonth({ billingCycle: "monthly", billingDay: 29, renewalDate: null }, 2028, 1)!)).toBe("2028-02-29");
  });

  it("billing_day 31 в апреле (30 дней) → 30.04", () => {
    expect(iso(expectedDateForMonth({ billingCycle: "monthly", billingDay: 31, renewalDate: null }, 2026, 3)!)).toBe("2026-04-30");
  });

  it("monthly без billing_day → null", () => {
    expect(expectedDateForMonth({ billingCycle: "monthly", billingDay: null, renewalDate: null }, 2026, 0)).toBeNull();
  });
});

describe("expectedDateForMonth — yearly (§4.2, критерий №2)", () => {
  const yearly = { billingCycle: "yearly" as const, billingDay: null, renewalDate: d("2025-09-15") };
  it("в месяц продления (сентябрь) → 15.09 целевого года", () => {
    expect(iso(expectedDateForMonth(yearly, 2026, 8)!)).toBe("2026-09-15");
  });
  it("в любой другой месяц → null", () => {
    expect(expectedDateForMonth(yearly, 2026, 7)).toBeNull();
    expect(expectedDateForMonth(yearly, 2026, 9)).toBeNull();
  });
});

describe("buildPlanLine — суммы и breakdown (§4.1)", () => {
  it("per_seat: сумма мест, breakdown", () => {
    const line = buildPlanLine(base, 2026, 2)!;
    expect(line.expectedAmount.toString()).toBe("30");
    expect(line.breakdown).toEqual({ fixed: "0", seatsCount: 3, seatsAmount: "30" });
    expect(iso(line.expectedDate)).toBe("2026-03-15");
  });

  it("hybrid: price + места", () => {
    const line = buildPlanLine(
      { ...base, billingModel: "hybrid", price: 20, seats: [{ seatPrice: 20 }] },
      2026,
      2
    )!;
    expect(line.expectedAmount.toString()).toBe("40");
    expect(line.breakdown).toEqual({ fixed: "20", seatsCount: 1, seatsAmount: "20" });
  });

  it("fixed: price, места игнорируются в breakdown", () => {
    const line = buildPlanLine(
      { ...base, billingModel: "fixed", price: 1200, seats: [{ seatPrice: 10 }] },
      2026,
      2
    )!;
    expect(line.expectedAmount.toString()).toBe("1200");
    expect(line.breakdown).toEqual({ fixed: "1200", seatsCount: 0, seatsAmount: "0" });
  });

  it("критерий №2: yearly $1200 попадает в план только в сентябре целиком", () => {
    const svc: PlanServiceInput = {
      ...base,
      billingModel: "fixed",
      billingCycle: "yearly",
      billingDay: null,
      renewalDate: d("2025-09-15"),
      price: 1200,
      seats: [],
    };
    expect(buildPlanLine(svc, 2026, 8)!.expectedAmount.toString()).toBe("1200");
    expect(buildPlanLine(svc, 2026, 7)).toBeNull();
  });

  it("неактивный сервис → не в плане", () => {
    expect(buildPlanLine({ ...base, status: "paused" }, 2026, 2)).toBeNull();
  });
});

describe("buildMonthlyPlan", () => {
  it("собирает только сервисы с списанием в месяце", () => {
    const services: PlanServiceInput[] = [
      base, // monthly день 15 → в плане
      { ...base, id: "s2", billingCycle: "yearly", billingDay: null, renewalDate: d("2025-06-10"), billingModel: "fixed", price: 500, seats: [] }, // июнь, не март
      { ...base, id: "s3", status: "archived" }, // не active
    ];
    const plan = buildMonthlyPlan(services, 2026, 2); // март
    expect(plan.map((l) => l.serviceId)).toEqual(["s1"]);
  });
});
