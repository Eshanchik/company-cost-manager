import { describe, it, expect } from "vitest";
import { appCalendarParts, appMonthStart } from "@/lib/calc/app-time";

describe("appCalendarParts / appMonthStart (APP_TZ)", () => {
  it("cron 1-го в 00:05 Киева = 21:05 UTC 31-го — месяц должен быть НОВЫЙ", () => {
    // 2026-08-01 00:05 Europe/Kyiv === 2026-07-31T21:05Z
    const at = new Date("2026-07-31T21:05:00.000Z");
    const p = appCalendarParts(at, "Europe/Kyiv");
    expect(p.year).toBe(2026);
    expect(p.month0).toBe(7); // август
    expect(p.day).toBe(1);
    // а «наивный» UTC дал бы июль — это и был баг
    expect(at.getUTCMonth()).toBe(6);
  });

  it("appMonthStart возвращает 1-е число месяца APP_TZ в UTC-полночь", () => {
    expect(
      appMonthStart(new Date("2026-07-31T21:05:00.000Z"), "Europe/Kyiv")
        .toISOString()
    ).toBe("2026-08-01T00:00:00.000Z");
  });

  it("внутри месяца работает как обычно", () => {
    expect(
      appMonthStart(new Date("2026-08-15T10:00:00.000Z"), "Europe/Kyiv")
        .toISOString()
    ).toBe("2026-08-01T00:00:00.000Z");
  });

  it("UTC-таймзона: без сдвига", () => {
    const p = appCalendarParts(new Date("2026-07-31T21:05:00.000Z"), "UTC");
    expect(p.month0).toBe(6);
    expect(p.day).toBe(31);
  });
});
