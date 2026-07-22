"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireAdmin, AuthorizationError } from "@/lib/authz";
import { writeAudit, buildDiff } from "@/lib/audit";
import { type ActionResult, ok, fail } from "@/lib/actions/types";

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Некорректный email"),
  role: z.enum(["viewer", "manager", "admin"]),
});

/** Пригласить email в whitelist с ролью (Admin). Доступ открывается без рестарта. */
export async function inviteEmail(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const parsed = inviteSchema.safeParse({
      email: formData.get("email"),
      role: formData.get("role"),
    });
    if (!parsed.success) return fail(parsed.error.issues[0]!.message);

    const created = await prisma.allowedEmail.create({
      data: {
        email: parsed.data.email,
        role: parsed.data.role,
        addedBy: admin.email ?? admin.id,
      },
    });
    // Если пользователь уже существовал (напр. был удалён из whitelist и снова
    // приглашён) — синхронизируем его роль.
    await prisma.user.updateMany({
      where: { email: parsed.data.email },
      data: { role: parsed.data.role },
    });
    await writeAudit({
      entity: "AllowedEmail",
      entityId: created.id,
      actor: admin.email ?? admin.id,
      action: "create",
      diff: { email: parsed.data.email, role: parsed.data.role },
    });
    revalidatePath("/settings");
    return ok(`${parsed.data.email} приглашён (${parsed.data.role})`);
  } catch (e) {
    if (e instanceof AuthorizationError) return fail(e.message);
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      return fail("Этот email уже в списке доступа");
    console.error("inviteEmail:", e);
    return fail("Не удалось пригласить");
  }
}

/** Сменить роль в whitelist (и у пользователя, если он есть). Admin. */
export async function updateAllowedRole(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const id = String(formData.get("id") ?? "");
    const role = String(formData.get("role") ?? "");
    if (!["viewer", "manager", "admin"].includes(role))
      return fail("Некорректная роль");

    const before = await prisma.allowedEmail.findUnique({ where: { id } });
    if (!before) return fail("Запись не найдена");

    // Защита от самоблокировки: админ не может понизить собственную роль.
    if (
      admin.email &&
      before.email.toLowerCase() === admin.email.toLowerCase() &&
      role !== "admin"
    ) {
      return fail("Нельзя понизить собственную роль администратора");
    }

    const updated = await prisma.allowedEmail.update({
      where: { id },
      data: { role: role as "viewer" | "manager" | "admin" },
    });
    await prisma.user.updateMany({
      where: { email: before.email },
      data: { role: role as "viewer" | "manager" | "admin" },
    });
    await writeAudit({
      entity: "AllowedEmail",
      entityId: id,
      actor: admin.email ?? admin.id,
      action: "update",
      diff: buildDiff(before, updated, ["role"]),
    });
    revalidatePath("/settings");
    return ok("Роль обновлена (применится при следующем входе)");
  } catch (e) {
    if (e instanceof AuthorizationError) return fail(e.message);
    console.error("updateAllowedRole:", e);
    return fail("Не удалось обновить роль");
  }
}

/** Отозвать доступ (удалить из whitelist). Admin. */
export async function removeAllowedEmail(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const id = String(formData.get("id") ?? "");
    const before = await prisma.allowedEmail.findUnique({ where: { id } });
    if (!before) return fail("Запись не найдена");

    if (admin.email && before.email.toLowerCase() === admin.email.toLowerCase())
      return fail("Нельзя отозвать доступ у самого себя");

    await prisma.allowedEmail.delete({ where: { id } });
    await writeAudit({
      entity: "AllowedEmail",
      entityId: id,
      actor: admin.email ?? admin.id,
      action: "delete",
      diff: { email: before.email, role: before.role },
    });
    revalidatePath("/settings");
    return ok(`Доступ для ${before.email} отозван`);
  } catch (e) {
    if (e instanceof AuthorizationError) return fail(e.message);
    console.error("removeAllowedEmail:", e);
    return fail("Не удалось отозвать доступ");
  }
}
