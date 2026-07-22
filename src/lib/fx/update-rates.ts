import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { SUPPORTED_CURRENCIES } from "@/lib/currencies";
import { fetchLatestRates } from "@/lib/fx/frankfurter";

export type FxUpdateResult = {
  ok: boolean;
  date?: string;
  updated?: number;
  error?: string;
};

/**
 * Тянет курсы с frankfurter.app и сохраняет их как `foreign → base` в FxRate
 * (совместимо с конвертацией сервис→базовая). База берётся из настроек.
 * Идемпотентно по (date, from, to).
 */
export async function updateFxRates(): Promise<FxUpdateResult> {
  const settings = await prisma.setting.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
  const base = settings.baseCurrency;
  const symbols = SUPPORTED_CURRENCIES.filter((c) => c !== base);

  try {
    const data = await fetchLatestRates(base, [...symbols]);
    const date = new Date(`${data.date}T00:00:00.000Z`);

    let updated = 0;
    for (const [currency, baseToForeign] of Object.entries(data.rates)) {
      if (!baseToForeign || baseToForeign <= 0) continue;
      // Храним foreign → base = 1 / (base → foreign).
      const rate = new Prisma.Decimal(1).div(new Prisma.Decimal(baseToForeign));
      await prisma.fxRate.upsert({
        where: {
          date_from_to: { date, from: currency, to: base },
        },
        update: { rate },
        create: { date, from: currency, to: base, rate },
      });
      updated++;
    }
    return { ok: true, date: data.date, updated };
  } catch (e) {
    const error = e instanceof Error ? e.message : "неизвестная ошибка";
    console.error("[fx] Не удалось обновить курсы:", error);
    return { ok: false, error };
  }
}
