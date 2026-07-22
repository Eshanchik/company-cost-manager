"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireAdmin, AuthorizationError } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { updateFxRates } from "@/lib/fx/update-rates";
import { SUPPORTED_CURRENCIES } from "@/lib/currencies";
import { type ActionResult, ok, fail } from "@/lib/actions/types";

const schema = z.object({
  from: z.enum(SUPPORTED_CURRENCIES),
  to: z.enum(SUPPORTED_CURRENCIES),
  date: z.string().min(1, "Укажите дату"),
  rate: z.coerce.number().positive("Курс должен быть > 0"),
});

/** Ручной ввод/правка курса (fallback, §2/§3.9) — только Admin. */
export async function upsertFxRate(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    const actor = await requireAdmin();
    const parsed = schema.safeParse({
      from: formData.get("from"),
      to: formData.get("to"),
      date: formData.get("date"),
      rate: formData.get("rate"),
    });
    if (!parsed.success) return fail(parsed.error.issues[0]!.message);
    if (parsed.data.from === parsed.data.to)
      return fail("Валюты должны отличаться");

    const date = new Date(`${parsed.data.date}T00:00:00.000Z`);
    const rate = new Prisma.Decimal(parsed.data.rate);

    const existing = await prisma.fxRate.findUnique({
      where: {
        date_from_to: { date, from: parsed.data.from, to: parsed.data.to },
      },
    });

    await prisma.fxRate.upsert({
      where: {
        date_from_to: { date, from: parsed.data.from, to: parsed.data.to },
      },
      update: { rate },
      create: { date, from: parsed.data.from, to: parsed.data.to, rate },
    });

    await writeAudit({
      entity: "FxRate",
      entityId: `${parsed.data.from}->${parsed.data.to}@${parsed.data.date}`,
      actor: actor.email ?? actor.id,
      action: existing ? "update" : "create",
      diff: {
        rate: {
          from: existing ? existing.rate.toString() : null,
          to: rate.toString(),
        },
      },
    });

    revalidatePath("/settings");
    return ok("Курс сохранён");
  } catch (e) {
    if (e instanceof AuthorizationError) return fail(e.message);
    console.error("Не удалось сохранить курс:", e);
    return fail("Не удалось сохранить курс");
  }
}

/** Ручной запуск обновления курсов с frankfurter.app — только Admin. */
export async function triggerFxUpdate(
  _prev: ActionResult | null,
  _formData: FormData
): Promise<ActionResult> {
  try {
    const actor = await requireAdmin();
    const res = await updateFxRates();
    if (!res.ok) return fail(`Не удалось обновить: ${res.error}`);
    await writeAudit({
      entity: "FxRate",
      entityId: `bulk@${res.date}`,
      actor: actor.email ?? actor.id,
      action: "refresh",
      diff: { updated: res.updated ?? 0, date: res.date ?? null },
    });
    revalidatePath("/settings");
    return ok(`Обновлено ${res.updated} курс(ов) на ${res.date}`);
  } catch (e) {
    if (e instanceof AuthorizationError) return fail(e.message);
    console.error("Не удалось обновить курсы:", e);
    return fail("Не удалось обновить курсы");
  }
}
