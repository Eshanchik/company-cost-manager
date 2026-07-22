import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("объединяет классы", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("разрешает конфликты Tailwind в пользу последнего", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("игнорирует falsy-значения", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
  });
});
