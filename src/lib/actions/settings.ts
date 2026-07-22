"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireAdmin, AuthorizationError } from "@/lib/authz";
import { writeAudit, buildDiff } from "@/lib/audit";
import { type ActionResult, ok, fail } from "@/lib/actions/types";
import { SUPPORTED_CURRENCIES } from "@/lib/currencies";

const schema = z.object({
  baseCurrency: z.enum(SUPPORTED_CURRENCIES),
  confirmationOverdueDays: z.coerce.number().int().min(0).max(60),
});

/** Гарантирует наличие singleton-строки настроек и возвращает её. */
export async function getSettings() {
  return prisma.setting.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
}

export async function updateSettings(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const parsed = schema.safeParse({
      baseCurrency: formData.get("baseCurrency"),
      confirmationOverdueDays: formData.get("confirmationOverdueDays"),
    });
    if (!parsed.success) return fail(parsed.error.issues[0]!.message);

    const before = await getSettings();
    const updated = await prisma.setting.update({
      where: { id: "singleton" },
      data: parsed.data,
    });
    await writeAudit({
      entity: "Setting",
      entityId: "singleton",
      actor: admin.email ?? admin.id,
      action: "update",
      diff: buildDiff(before, updated, [
        "baseCurrency",
        "confirmationOverdueDays",
      ]),
    });
    revalidatePath("/settings");
    return ok("Настройки сохранены");
  } catch (e) {
    if (e instanceof AuthorizationError) return fail(e.message);
    console.error("Не удалось сохранить настройки:", e);
    return fail("Не удалось сохранить настройки");
  }
}
