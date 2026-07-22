"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireManager, AuthorizationError } from "@/lib/authz";
import { writeAudit, buildDiff } from "@/lib/audit";
import { type ActionResult, ok, fail } from "@/lib/actions/types";

const addSchema = z.object({
  serviceId: z.string().min(1),
  email: z.string().trim().toLowerCase().email("Некорректный email"),
  fullName: z.string().trim().max(120).optional().or(z.literal("")),
  seatPrice: z.coerce.number().min(0).optional(),
});

function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? email;
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

export async function addSeat(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    const actor = await requireManager();
    const parsed = addSchema.safeParse({
      serviceId: formData.get("serviceId"),
      email: formData.get("email"),
      fullName: formData.get("fullName") ?? "",
      seatPrice: formData.get("seatPrice") || undefined,
    });
    if (!parsed.success) return fail(parsed.error.issues[0]!.message);
    const { serviceId, email, fullName, seatPrice } = parsed.data;

    const service = await prisma.service.findUnique({
      where: { id: serviceId },
    });
    if (!service) return fail("Сервис не найден");
    if (service.billingModel === "fixed")
      return fail("У сервиса с моделью fixed нет мест");

    const price =
      seatPrice != null
        ? new Prisma.Decimal(seatPrice)
        : (service.seatPriceDefault ?? new Prisma.Decimal(0));

    await prisma.$transaction(async (tx) => {
      // Автосоздание сотрудника по новому email (§3.6).
      let employee = await tx.employee.findUnique({ where: { email } });
      if (!employee) {
        employee = await tx.employee.create({
          data: { email, fullName: fullName || nameFromEmail(email) },
        });
        await writeAudit(
          {
            entity: "Employee",
            entityId: employee.id,
            actor: actor.email ?? actor.id,
            action: "create",
            diff: buildDiff(null, employee, ["email", "fullName"]),
          },
          tx
        );
      }

      // Валидация: не более одного активного места на пару (service, employee).
      const active = await tx.seat.findFirst({
        where: { serviceId, employeeId: employee.id, endedAt: null },
      });
      if (active) {
        throw new ActiveSeatExists();
      }

      const seat = await tx.seat.create({
        data: { serviceId, employeeId: employee.id, seatPrice: price },
      });
      await writeAudit(
        {
          entity: "Seat",
          entityId: seat.id,
          actor: actor.email ?? actor.id,
          action: "create",
          diff: {
            serviceId,
            employeeId: employee.id,
            seatPrice: price.toString(),
          },
        },
        tx
      );
      return seat;
    });

    revalidatePath(`/services/${serviceId}`);
    revalidatePath("/employees");
    revalidatePath("/services");
    return ok(`Место добавлено (${email})`);
  } catch (e) {
    if (e instanceof ActiveSeatExists)
      return fail("У этого сотрудника уже есть активное место в сервисе");
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    )
      return fail("У этого сотрудника уже есть активное место в сервисе");
    return toError(e, "добавить место");
  }
}

export async function endSeat(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    const actor = await requireManager();
    const seatId = String(formData.get("seatId") ?? "");
    if (!seatId) return fail("Не указано место");

    const seat = await prisma.seat.findUnique({ where: { id: seatId } });
    if (!seat) return fail("Место не найдено");
    if (seat.endedAt) return fail("Место уже закрыто");

    await prisma.seat.update({
      where: { id: seatId },
      data: { endedAt: new Date() },
    });
    await writeAudit({
      entity: "Seat",
      entityId: seatId,
      actor: actor.email ?? actor.id,
      action: "end",
      diff: { endedAt: { from: null, to: new Date().toISOString() } },
    });
    revalidatePath(`/services/${seat.serviceId}`);
    revalidatePath("/employees");
    revalidatePath("/services");
    return ok("Место закрыто");
  } catch (e) {
    return toError(e, "закрыть место");
  }
}

/** Отмена закрытия места (undo) — возвращает endedAt=null. */
export async function reopenSeat(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    const actor = await requireManager();
    const seatId = String(formData.get("seatId") ?? "");
    if (!seatId) return fail("Не указано место");

    const seat = await prisma.seat.findUnique({ where: { id: seatId } });
    if (!seat) return fail("Место не найдено");
    if (!seat.endedAt) return ok("Место уже активно");

    // Проверяем, что за время закрытия не появилось другое активное место.
    const conflict = await prisma.seat.findFirst({
      where: {
        serviceId: seat.serviceId,
        employeeId: seat.employeeId,
        endedAt: null,
        NOT: { id: seatId },
      },
    });
    if (conflict)
      return fail("Нельзя вернуть: у сотрудника уже есть активное место");

    await prisma.seat.update({
      where: { id: seatId },
      data: { endedAt: null },
    });
    await writeAudit({
      entity: "Seat",
      entityId: seatId,
      actor: actor.email ?? actor.id,
      action: "reopen",
      diff: { endedAt: { from: seat.endedAt.toISOString(), to: null } },
    });
    revalidatePath(`/services/${seat.serviceId}`);
    revalidatePath("/employees");
    revalidatePath("/services");
    return ok("Закрытие отменено");
  } catch (e) {
    return toError(e, "вернуть место");
  }
}

class ActiveSeatExists extends Error {}

function toError(e: unknown, verb: string): ActionResult {
  if (e instanceof AuthorizationError) return fail(e.message);
  console.error(`Не удалось ${verb}:`, e);
  return fail(`Не удалось ${verb}`);
}
