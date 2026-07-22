"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin, AuthorizationError } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { generateSnapshot } from "@/lib/plan/generate-snapshot";
import { type ActionResult, ok, fail } from "@/lib/actions/types";

/** Ручная пересборка план-снапшота текущего месяца — только Admin (§3.8). */
export async function rebuildCurrentSnapshot(
  _prev: ActionResult | null,
  _formData: FormData
): Promise<ActionResult> {
  try {
    const actor = await requireAdmin();
    const now = new Date();
    const res = await generateSnapshot({
      year: now.getUTCFullYear(),
      month0: now.getUTCMonth(),
      asOf: now,
      force: true,
    });

    await writeAudit({
      entity: "PlanSnapshot",
      entityId: res.month,
      actor: actor.email ?? actor.id,
      action: "rebuild",
      diff: { month: res.month, lines: res.lines },
    });

    revalidatePath("/settings");
    revalidatePath("/reports");
    revalidatePath("/");
    return ok(`Снапшот ${res.month} пересобран: ${res.lines} строк`);
  } catch (e) {
    if (e instanceof AuthorizationError) return fail(e.message);
    console.error("Не удалось пересобрать снапшот:", e);
    return fail("Не удалось пересобрать снапшот");
  }
}
