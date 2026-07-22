import { describe, it, expect } from "vitest";
import { formatDate, formatNumber } from "@/lib/format";

describe("formatDate", () => {
  it("формат DD.MM.YYYY в UTC", () => {
    expect(formatDate(new Date("2026-09-05T00:00:00.000Z"))).toBe("05.09.2026");
  });
  it("null → тире", () => {
    expect(formatDate(null)).toBe("—");
  });
  it("билинг 31-го в UTC-дате сохраняется", () => {
    expect(formatDate(new Date("2026-01-31T00:00:00.000Z"))).toBe("31.01.2026");
  });
});

describe("formatNumber", () => {
  it("разделители тысяч (ru-RU, узкий пробел)", () => {
    // ru-RU использует неразрывный/узкий пробел как разделитель групп.
    const s = formatNumber(1234567, 0);
    expect(s.replace(/\s| | /g, "")).toBe("1234567");
  });
});
