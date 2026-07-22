import { describe, it, expect } from "vitest";
import { classifySeat } from "@/lib/seats/unused";

const asOf = new Date("2026-07-23T00:00:00.000Z");
const daysAgo = (n: number) => new Date(asOf.getTime() - n * 86400000);

describe("classifySeat (детект неиспользуемых мест)", () => {
  it("активное место офбордингнутого сотрудника → offboarded", () => {
    expect(
      classifySeat(
        { endedAt: null, lastUsedAt: null, employeeStatus: "offboarded" },
        30,
        asOf
      )
    ).toBe("offboarded");
  });

  it("активность старше порога → idle", () => {
    expect(
      classifySeat(
        { endedAt: null, lastUsedAt: daysAgo(45), employeeStatus: "active" },
        30,
        asOf
      )
    ).toBe("idle");
  });

  it("свежая активность → null", () => {
    expect(
      classifySeat(
        { endedAt: null, lastUsedAt: daysAgo(10), employeeStatus: "active" },
        30,
        asOf
      )
    ).toBeNull();
  });

  it("нет отметки активности и активный сотрудник → null (без ложных срабатываний)", () => {
    expect(
      classifySeat(
        { endedAt: null, lastUsedAt: null, employeeStatus: "active" },
        30,
        asOf
      )
    ).toBeNull();
  });

  it("закрытое место → null", () => {
    expect(
      classifySeat(
        { endedAt: daysAgo(1), lastUsedAt: daysAgo(90), employeeStatus: "offboarded" },
        30,
        asOf
      )
    ).toBeNull();
  });

  it("офбординг приоритетнее idle", () => {
    expect(
      classifySeat(
        { endedAt: null, lastUsedAt: daysAgo(90), employeeStatus: "offboarded" },
        30,
        asOf
      )
    ).toBe("offboarded");
  });
});
