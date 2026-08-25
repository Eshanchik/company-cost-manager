"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireManager, AuthorizationError } from "@/lib/authz";
import { writeAudit, buildDiff } from "@/lib/audit";
import { type ActionResult, ok, fail } from "@/lib/actions/types";
import { parseEmailList } from "@/lib/seats/emails";

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

/** Отметить активность места (last_used_at = сейчас) — Manager+. */
export async function markSeatUsed(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    await requireManager();
    const seatId = String(formData.get("seatId") ?? "");
    if (!seatId) return fail("Не указано место");
    const seat = await prisma.seat.findUnique({ where: { id: seatId } });
    if (!seat) return fail("Место не найдено");
    await prisma.seat.update({
      where: { id: seatId },
      data: { lastUsedAt: new Date() },
    });
    revalidatePath(`/services/${seat.serviceId}`);
    revalidatePath("/");
    return ok("Активность отмечена");
  } catch (e) {
    return toError(e, "отметить активность");
  }
}

class ActiveSeatExists extends Error {}

function toError(e: unknown, verb: string): ActionResult {
  if (e instanceof AuthorizationError) return fail(e.message);
  console.error(`Не удалось ${verb}:`, e);
  return fail(`Не удалось ${verb}`);
}

// ── Массовое добавление мест ─────────────────────────────────────────────────

const MAX_BULK_EMAILS = 200;

export type BulkSeatsResult =
  | {
      ok: true;
      added: number;
      skipped: { email: string; reason: string }[];
      message: string;
    }
  | { ok: false; error: string };

/**
 * Добавляет места сразу нескольким сотрудникам (Manager+).
 * Каждый email обрабатывается независимо в своей транзакции: одна ошибка не
 * откатывает остальных. Уже занятые места пропускаются (это не ошибка).
 */
export async function bulkAddSeats(
  _prev: BulkSeatsResult | null,
  formData: FormData
): Promise<BulkSeatsResult> {
  try {
    const actor = await requireManager();
    const serviceId = String(formData.get("serviceId") ?? "");
    const rawEmails = String(formData.get("emails") ?? "");
    const rawPrice = String(formData.get("seatPrice") ?? "").trim();

    if (!serviceId) return { ok: false, error: "Не указан сервис" };

    const { emails, invalid } = parseEmailList(rawEmails);
    if (emails.length === 0 && invalid.length === 0)
      return { ok: false, error: "Список email пуст" };
    if (emails.length > MAX_BULK_EMAILS)
      return {
        ok: false,
        error: `Слишком много адресов за раз (${emails.length}), максимум ${MAX_BULK_EMAILS}`,
      };

    const service = await prisma.service.findUnique({ where: { id: serviceId } });
    if (!service) return { ok: false, error: "Сервис не найден" };
    if (service.billingModel === "fixed")
      return { ok: false, error: "У сервиса с моделью fixed нет мест" };

    const price =
      rawPrice !== ""
        ? new Prisma.Decimal(rawPrice)
        : (service.seatPriceDefault ?? new Prisma.Decimal(0));

    const skipped: { email: string; reason: string }[] = invalid.map((e) => ({
      email: e,
      reason: "некорректный email",
    }));
    let added = 0;

    for (const email of emails) {
      try {
        await prisma.$transaction(async (tx) => {
          let employee = await tx.employee.findUnique({ where: { email } });
          if (!employee) {
            employee = await tx.employee.create({
              data: { email, fullName: nameFromEmail(email) },
            });
            await writeAudit(
              {
                entity: "Employee",
                entityId: employee.id,
                actor: actor.email ?? actor.id,
                action: "create",
                diff: { email, source: "bulk_seats" },
              },
              tx
            );
          }

          const active = await tx.seat.findFirst({
            where: { serviceId, employeeId: employee.id, endedAt: null },
          });
          if (active) throw new ActiveSeatExists();

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
                source: "bulk",
              },
            },
            tx
          );
        });
        added++;
      } catch (e) {
        if (
          e instanceof ActiveSeatExists ||
          (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
        ) {
          skipped.push({ email, reason: "место уже активно" });
        } else {
          console.error("bulkAddSeats:", email, e);
          skipped.push({ email, reason: "ошибка вставки" });
        }
      }
    }

    revalidatePath(`/services/${serviceId}`);
    revalidatePath("/services");
    revalidatePath("/employees");

    return {
      ok: true,
      added,
      skipped,
      message:
        skipped.length === 0
          ? `Добавлено мест: ${added}`
          : `Добавлено мест: ${added}, пропущено: ${skipped.length}`,
    };
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false, error: e.message };
    console.error("bulkAddSeats:", e);
    return { ok: false, error: "Не удалось добавить места" };
  }
}
