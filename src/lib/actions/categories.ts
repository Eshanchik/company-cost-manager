"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireAdmin, AuthorizationError } from "@/lib/authz";
import { writeAudit, buildDiff } from "@/lib/audit";
import { type ActionResult, ok, fail } from "@/lib/actions/types";

const HEX = /^#([0-9a-fA-F]{6})$/;

const schema = z.object({
  name: z.string().trim().min(1, "Укажите название").max(60),
  color: z.string().trim().regex(HEX, "Цвет в формате #RRGGBB"),
});

function parse(formData: FormData) {
  return schema.safeParse({
    name: formData.get("name"),
    color: formData.get("color"),
  });
}

export async function createCategory(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const parsed = parse(formData);
    if (!parsed.success) return fail(parsed.error.issues[0]!.message);

    const created = await prisma.category.create({ data: parsed.data });
    await writeAudit({
      entity: "Category",
      entityId: created.id,
      actor: admin.email ?? admin.id,
      action: "create",
      diff: buildDiff(null, created, ["name", "color"]),
    });
    revalidatePath("/settings");
    return ok("Категория создана");
  } catch (e) {
    return toError(e, "создать категорию");
  }
}

export async function updateCategory(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const id = String(formData.get("id") ?? "");
    if (!id) return fail("Не указан идентификатор");
    const parsed = parse(formData);
    if (!parsed.success) return fail(parsed.error.issues[0]!.message);

    const before = await prisma.category.findUnique({ where: { id } });
    if (!before) return fail("Категория не найдена");

    const updated = await prisma.category.update({
      where: { id },
      data: parsed.data,
    });
    await writeAudit({
      entity: "Category",
      entityId: id,
      actor: admin.email ?? admin.id,
      action: "update",
      diff: buildDiff(before, updated, ["name", "color"]),
    });
    revalidatePath("/settings");
    return ok("Категория обновлена");
  } catch (e) {
    return toError(e, "обновить категорию");
  }
}

export async function deleteCategory(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const id = String(formData.get("id") ?? "");
    if (!id) return fail("Не указан идентификатор");

    const inUse = await prisma.service.count({ where: { categoryId: id } });
    if (inUse > 0)
      return fail(
        `Нельзя удалить: категория используется в ${inUse} сервис(ах)`
      );

    const before = await prisma.category.findUnique({ where: { id } });
    if (!before) return fail("Категория не найдена");

    await prisma.category.delete({ where: { id } });
    await writeAudit({
      entity: "Category",
      entityId: id,
      actor: admin.email ?? admin.id,
      action: "delete",
      diff: buildDiff(before, {} as typeof before, ["name", "color"]),
    });
    revalidatePath("/settings");
    return ok("Категория удалена");
  } catch (e) {
    return toError(e, "удалить категорию");
  }
}

function toError(e: unknown, verb: string): ActionResult {
  if (e instanceof AuthorizationError) return fail(e.message);
  if (
    e instanceof Prisma.PrismaClientKnownRequestError &&
    e.code === "P2002"
  ) {
    return fail("Категория с таким названием уже существует");
  }
  console.error(`Не удалось ${verb}:`, e);
  return fail(`Не удалось ${verb}`);
}
