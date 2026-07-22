"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireAdmin, AuthorizationError } from "@/lib/authz";
import { writeAudit, buildDiff } from "@/lib/audit";
import { type ActionResult, ok, fail } from "@/lib/actions/types";

const schema = z.object({
  name: z.string().trim().min(1, "Укажите название").max(120),
  note: z.string().trim().max(300).optional().or(z.literal("")),
});

function parse(formData: FormData) {
  return schema.safeParse({
    name: formData.get("name"),
    note: formData.get("note") ?? "",
  });
}

export async function createPaymentMethod(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const parsed = parse(formData);
    if (!parsed.success) return fail(parsed.error.issues[0]!.message);

    const created = await prisma.paymentMethod.create({
      data: { name: parsed.data.name, note: parsed.data.note || null },
    });
    await writeAudit({
      entity: "PaymentMethod",
      entityId: created.id,
      actor: admin.email ?? admin.id,
      action: "create",
      diff: buildDiff(null, created, ["name", "note", "isArchived"]),
    });
    revalidatePath("/settings");
    return ok("Способ оплаты создан");
  } catch (e) {
    return toError(e, "создать способ оплаты");
  }
}

export async function updatePaymentMethod(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const id = String(formData.get("id") ?? "");
    if (!id) return fail("Не указан идентификатор");
    const parsed = parse(formData);
    if (!parsed.success) return fail(parsed.error.issues[0]!.message);

    const before = await prisma.paymentMethod.findUnique({ where: { id } });
    if (!before) return fail("Способ оплаты не найден");

    const updated = await prisma.paymentMethod.update({
      where: { id },
      data: { name: parsed.data.name, note: parsed.data.note || null },
    });
    await writeAudit({
      entity: "PaymentMethod",
      entityId: id,
      actor: admin.email ?? admin.id,
      action: "update",
      diff: buildDiff(before, updated, ["name", "note", "isArchived"]),
    });
    revalidatePath("/settings");
    return ok("Способ оплаты обновлён");
  } catch (e) {
    return toError(e, "обновить способ оплаты");
  }
}

/** Архивация/разархивация (§3.3). Удаления нет — только архив. */
export async function setPaymentMethodArchived(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const id = String(formData.get("id") ?? "");
    const archived = String(formData.get("archived") ?? "") === "true";
    if (!id) return fail("Не указан идентификатор");

    const before = await prisma.paymentMethod.findUnique({ where: { id } });
    if (!before) return fail("Способ оплаты не найден");

    const updated = await prisma.paymentMethod.update({
      where: { id },
      data: { isArchived: archived },
    });
    await writeAudit({
      entity: "PaymentMethod",
      entityId: id,
      actor: admin.email ?? admin.id,
      action: archived ? "archive" : "unarchive",
      diff: buildDiff(before, updated, ["isArchived"]),
    });
    revalidatePath("/settings");
    return ok(archived ? "Отправлено в архив" : "Возвращено из архива");
  } catch (e) {
    return toError(e, "изменить архивный статус");
  }
}

function toError(e: unknown, verb: string): ActionResult {
  if (e instanceof AuthorizationError) return fail(e.message);
  console.error(`Не удалось ${verb}:`, e);
  return fail(`Не удалось ${verb}`);
}
