"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireManager, AuthorizationError } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { normalizeToMonthly } from "@/lib/calc/service-cost";
import { type ActionResult, ok, fail } from "@/lib/actions/types";

/**
 * Офбординг сотрудника (§4.6): массовое закрытие выбранных мест (ended_at),
 * статус → offboarded, подсчёт экономии/мес. Manager+.
 */
export async function offboardEmployee(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    const actor = await requireManager();
    const employeeId = String(formData.get("employeeId") ?? "");
    const seatIds = formData.getAll("seatId").map(String).filter(Boolean);
    if (!employeeId) return fail("Не указан сотрудник");

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        seats: {
          where: { endedAt: null, id: { in: seatIds } },
          include: { service: { select: { billingCycle: true, currency: true } } },
        },
      },
    });
    if (!employee) return fail("Сотрудник не найден");

    // Экономия/мес по валютам.
    const savings = new Map<string, Prisma.Decimal>();
    for (const seat of employee.seats) {
      const monthly = normalizeToMonthly(
        new Prisma.Decimal(seat.seatPrice),
        seat.service.billingCycle
      );
      savings.set(
        seat.service.currency,
        (savings.get(seat.service.currency) ?? new Prisma.Decimal(0)).add(monthly)
      );
    }

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      if (seatIds.length > 0) {
        await tx.seat.updateMany({
          where: { id: { in: seatIds }, employeeId, endedAt: null },
          data: { endedAt: now },
        });
      }
      await tx.employee.update({
        where: { id: employeeId },
        data: { status: "offboarded", offboardedAt: now },
      });
      await writeAudit(
        {
          entity: "Employee",
          entityId: employeeId,
          actor: actor.email ?? actor.id,
          action: "offboard",
          diff: {
            closed_seats: employee.seats.length,
            status: { from: "active", to: "offboarded" },
          },
        },
        tx
      );
    });

    revalidatePath("/employees");
    revalidatePath(`/employees/${employeeId}`);
    revalidatePath("/services");

    const savingsStr =
      [...savings.entries()]
        .map(([cur, amt]) => `${amt.toFixed(2)} ${cur}`)
        .join(" + ") || "0";
    return ok(
      `Офбординг завершён: закрыто мест ${employee.seats.length}, экономия ${savingsStr}/мес`
    );
  } catch (e) {
    if (e instanceof AuthorizationError) return fail(e.message);
    console.error("offboardEmployee:", e);
    return fail("Не удалось выполнить офбординг");
  }
}
