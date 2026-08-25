/**
 * Календарные «сегодня/этот месяц» в таймзоне приложения (APP_TZ).
 *
 * Зачем: cron снапшота планируется в APP_TZ («5 0 1 * *» = 1-го в 00:05 Киева),
 * но это 21:05/22:05 UTC ПОСЛЕДНЕГО дня предыдущего месяца. Если брать месяц
 * через getUTCMonth(), cron будет пересобирать прошлый месяц (и молча выходить,
 * т.к. снапшот уже есть) — снапшот нового месяца не создастся никогда.
 */
export function appTz(): string {
  return process.env.APP_TZ || "Europe/Kyiv";
}

/** Календарные год/месяц(0-based)/день в таймзоне приложения. */
export function appCalendarParts(
  at: Date = new Date(),
  timeZone: string = appTz()
): { year: number; month0: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);

  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return {
    year: get("year"),
    month0: get("month") - 1,
    day: get("day"),
  };
}

/** Первое число текущего (в APP_TZ) месяца как UTC-полночь. */
export function appMonthStart(
  at: Date = new Date(),
  timeZone: string = appTz()
): Date {
  const { year, month0 } = appCalendarParts(at, timeZone);
  return new Date(Date.UTC(year, month0, 1));
}
