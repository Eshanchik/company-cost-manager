"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireAdmin, AuthorizationError } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { generateToken } from "@/lib/api/token";
import { type ActionResult, ok, fail } from "@/lib/actions/types";

export type CreateTokenResult =
  | { ok: true; token: string; message: string }
  | { ok: false; error: string };

const schema = z.object({
  name: z.string().trim().min(1, "Укажите имя токена").max(80),
  role: z.enum(["viewer", "manager", "admin"]),
});

/** Создать API/MCP-токен (Admin). Значение возвращается ОДИН раз. */
export async function createApiToken(
  _prev: CreateTokenResult | null,
  formData: FormData
): Promise<CreateTokenResult> {
  try {
    const admin = await requireAdmin();
    const parsed = schema.safeParse({
      name: formData.get("name"),
      role: formData.get("role"),
    });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };

    const { token, prefix, hash } = generateToken();
    const created = await prisma.apiToken.create({
      data: {
        name: parsed.data.name,
        role: parsed.data.role,
        tokenHash: hash,
        prefix,
        createdBy: admin.email ?? admin.id,
      },
    });
    await writeAudit({
      entity: "ApiToken",
      entityId: created.id,
      actor: admin.email ?? admin.id,
      action: "create",
      diff: { name: parsed.data.name, role: parsed.data.role },
    });
    revalidatePath("/settings");
    return { ok: true, token, message: "Токен создан" };
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false, error: e.message };
    console.error("createApiToken:", e);
    return { ok: false, error: "Не удалось создать токен" };
  }
}

/** Отозвать токен (Admin). */
export async function revokeApiToken(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const id = String(formData.get("id") ?? "");
    if (!id) return fail("Не указан токен");

    const token = await prisma.apiToken.findUnique({ where: { id } });
    if (!token) return fail("Токен не найден");
    if (token.revokedAt) return ok("Токен уже отозван");

    await prisma.apiToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
    await writeAudit({
      entity: "ApiToken",
      entityId: id,
      actor: admin.email ?? admin.id,
      action: "revoke",
      diff: { name: token.name },
    });
    revalidatePath("/settings");
    return ok("Токен отозван");
  } catch (e) {
    if (e instanceof AuthorizationError) return fail(e.message);
    console.error("revokeApiToken:", e);
    return fail("Не удалось отозвать токен");
  }
}
