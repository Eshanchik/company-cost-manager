// Загрузка курсов валют с frankfurter.app (данные ЕЦБ).
// Возвращает курсы base → symbols на дату публикации.

const BASE_URL = "https://api.frankfurter.app";

export type FrankfurterResponse = {
  amount: number;
  base: string;
  date: string; // YYYY-MM-DD
  rates: Record<string, number>;
};

/**
 * Курсы base → каждая из `symbols` на последнюю доступную дату.
 * Бросает при сетевой/HTTP-ошибке.
 */
export async function fetchLatestRates(
  base: string,
  symbols: string[]
): Promise<FrankfurterResponse> {
  const targets = symbols.filter((s) => s !== base);
  if (targets.length === 0) {
    return { amount: 1, base, date: isoToday(), rates: {} };
  }
  const url = `${BASE_URL}/latest?from=${encodeURIComponent(
    base
  )}&to=${encodeURIComponent(targets.join(","))}`;

  const res = await fetch(url, {
    headers: { accept: "application/json" },
    // Курсы обновляются раз в день — короткий кэш допустим.
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`frankfurter.app вернул ${res.status}`);
  }
  return (await res.json()) as FrankfurterResponse;
}

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}
