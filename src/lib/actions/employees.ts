"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireManager, AuthorizationError } from "@/lib/authz";
import { writeAudit, buildDiff } from "@/lib/audit";
import { type ActionResult, ok, fail } from "@/lib/actions/types";

const schema = z.object({
  id: z.string().min(1),
  fullName: z.string().trim().min(1, "Укажите имя").max(120),
  department: z.string().trim().max(120).optional().or(z.literal("")),
});

export async function updateEmployee(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    const actor = await requireManager();
    const parsed = schema.safeParse({
      id: formData.get("id"),
      fullName: formData.get("fullName"),
      department: formData.get("department") ?? "",
    });
    if (!parsed.success) return fail(parsed.error.issues[0]!.message);
    const { id, fullName, department } = parsed.data;

    const before = await prisma.employee.findUnique({ where: { id } });
    if (!before) return fail("Сотрудник не найден");

    const updated = await prisma.employee.update({
      where: { id },
      data: { fullName, department: department || null },
    });
    await writeAudit({
      entity: "Employee",
      entityId: id,
      actor: actor.email ?? actor.id,
      action: "update",
      diff: buildDiff(before, updated, ["fullName", "department"]),
    });
    revalidatePath("/employees");
    revalidatePath(`/employees/${id}`);
    return ok("Сотрудник обновлён");
  } catch (e) {
    if (e instanceof AuthorizationError) return fail(e.message);
    console.error("Не удалось обновить сотрудника:", e);
    return fail("Не удалось обновить сотрудника");
  }
}
