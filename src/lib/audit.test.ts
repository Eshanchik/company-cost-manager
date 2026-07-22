import { describe, it, expect } from "vitest";
import { buildDiff } from "@/lib/audit";

describe("buildDiff", () => {
  it("возвращает только изменившиеся поля", () => {
    const before = { name: "A", color: "#000000" };
    const after = { name: "B", color: "#000000" };
    expect(buildDiff(before, after, ["name", "color"])).toEqual({
      name: { from: "A", to: "B" },
    });
  });

  it("для создания (before=null) все поля идут как from:null", () => {
    const after = { name: "New", color: "#fff" };
    expect(buildDiff(null, after, ["name", "color"])).toEqual({
      name: { from: null, to: "New" },
      color: { from: null, to: "#fff" },
    });
  });

  it("нормализует Date в ISO-строку", () => {
    const d1 = new Date("2026-01-01T00:00:00.000Z");
    const d2 = new Date("2026-02-01T00:00:00.000Z");
    expect(buildDiff({ at: d1 }, { at: d2 }, ["at"])).toEqual({
      at: { from: d1.toISOString(), to: d2.toISOString() },
    });
  });

  it("пустой diff, если ничего не изменилось", () => {
    const obj = { a: 1, b: true };
    expect(buildDiff(obj, obj, ["a", "b"])).toEqual({});
  });
});
