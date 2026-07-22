import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import {
  serviceCycleCost,
  normalizeToMonthly,
  serviceMonthlyRunRate,
  seatsTotal,
} from "@/lib/calc/service-cost";

const D = (n: number | string) => new Prisma.Decimal(n);
const seats = (...prices: number[]) => prices.map((p) => ({ seatPrice: p }));

describe("serviceCycleCost (§4.1)", () => {
  it("fixed → price, места игнорируются", () => {
    expect(
      serviceCycleCost({ billingModel: "fixed", price: 1200, seats: seats(10, 20) }).toString()
    ).toBe("1200");
  });

  it("per_seat → сумма мест, price игнорируется", () => {
    expect(
      serviceCycleCost({ billingModel: "per_seat", price: 999, seats: seats(10, 10, 10) }).toString()
    ).toBe("30");
  });

  it("hybrid → price + сумма мест", () => {
    expect(
      serviceCycleCost({ billingModel: "hybrid", price: 20, seats: seats(20, 20) }).toString()
    ).toBe("60");
  });

  it("per_seat без мест → 0", () => {
    expect(
      serviceCycleCost({ billingModel: "per_seat", price: 0, seats: [] }).toString()
    ).toBe("0");
  });
});

describe("seatsTotal", () => {
  it("складывает дробные цены без потери точности", () => {
    expect(seatsTotal(seats(8.75, 8.75, 8.75)).toString()).toBe("26.25");
  });
});

describe("normalizeToMonthly (run-rate)", () => {
  it("monthly → без изменений", () => {
    expect(normalizeToMonthly(D(100), "monthly").toString()).toBe("100");
  });

  it("yearly → делится на 12", () => {
    expect(normalizeToMonthly(D(1200), "yearly").toString()).toBe("100");
  });
});

describe("serviceMonthlyRunRate", () => {
  it("критерий №1: per_seat 3×$10/мес = $30/мес", () => {
    expect(
      serviceMonthlyRunRate({
        billingModel: "per_seat",
        billingCycle: "monthly",
        price: 0,
        seats: seats(10, 10, 10),
      }).toString()
    ).toBe("30");
  });

  it("критерий №1: закрытие места → $20/мес", () => {
    expect(
      serviceMonthlyRunRate({
        billingModel: "per_seat",
        billingCycle: "monthly",
        price: 0,
        seats: seats(10, 10),
      }).toString()
    ).toBe("20");
  });

  it("критерий №2: yearly $1200 → $100/мес нормализованно", () => {
    expect(
      serviceMonthlyRunRate({
        billingModel: "fixed",
        billingCycle: "yearly",
        price: 1200,
        seats: [],
      }).toString()
    ).toBe("100");
  });
});
