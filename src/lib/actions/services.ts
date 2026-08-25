"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireManager, AuthorizationError } from "@/lib/authz";
import { writeAudit, buildDiff } from "@/lib/audit";
import { computeNextPaymentDate } from "@/lib/calc/dates";
import { appMonthStart } from "@/lib/calc/app-time";
import { SUPPORTED_CURRENCIES } from "@/lib/currencies";
import { type ActionResult, ok, fail } from "@/lib/actions/types";

const AUDIT_FIELDS = [
  "kind",
  "name",
  "registrar",
  "autoRenew",
  "vendorUrl",
  "categoryId",
  "description",
  "billingModel",
  "billingCycle",
  "price",
  "seatPriceDefault",
  "currency",
  "billingDay",
  "renewalDate",
  "prepaidUntil",
  "paymentMethodId",
  "ownerId",
  "backupOwnerId",
  "status",
  "cancellationNoticeDays",
  "notes",
] as const;

const schema = z
  .object({
    name: z.string().trim().min(1, "Укажите название").max(120),
    vendorUrl: z.string().trim().max(300).optional().or(z.literal("")),
    categoryId: z.string().trim().optional().or(z.literal("")),
    description: z.string().trim().max(2000).optional().or(z.literal("")),
    kind: z.enum(["service", "domain"]).default("service"),
    registrar: z.string().trim().max(120).optional().or(z.literal("")),
    autoRenew: z.coerce.boolean().default(true),
    billingModel: z.enum(["fixed", "per_seat", "hybrid"]),
    billingCycle: z.enum(["monthly", "quarterly", "yearly"]),
    price: z.coerce.number().min(0).default(0),
    seatPriceDefault: z.coerce.number().min(0).optional(),
    currency: z.enum(SUPPORTED_CURRENCIES),
    billingDay: z.coerce.number().int().min(1).max(31).optional(),
    renewalDate: z.string().trim().optional().or(z.literal("")),
    prepaidUntil: z.string().trim().optional().or(z.literal("")),
    paymentMethodId: z.string().trim().optional().or(z.literal("")),
    ownerId: z.string().trim().min(1, "Укажите ответственного"),
    backupOwnerId: z.string().trim().optional().or(z.literal("")),
    status: z
      .enum(["active", "paused", "cancelled", "archived"])
      .default("active"),
    cancellationNoticeDays: z.coerce.number().int().min(0).max(365).default(30),
    tags: z.string().trim().optional().or(z.literal("")),
    notes: z.string().trim().max(2000).optional().or(z.literal("")),
  })
  .superRefine((v, ctx) => {
    if (v.billingModel !== "fixed" && (v.seatPriceDefault ?? 0) <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["seatPriceDefault"],
        message: "Для per_seat/hybrid укажите цену места",
      });
    }
    if (v.billingCycle === "monthly" && v.billingDay == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["billingDay"],
        message: "Для monthly укажите день списания (1–31)",
      });
    }
    if (v.billingCycle === "yearly" && !v.renewalDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["renewalDate"],
        message: "Для yearly укажите дату продления",
      });
    }
    if (v.billingCycle === "quarterly" && !v.renewalDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["renewalDate"],
        message: "Для quarterly укажите опорную дату списания",
      });
    }
    if (v.kind === "domain" && v.billingModel !== "fixed") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["billingModel"],
        message: "У домена не бывает мест — модель только «фиксированная»",
      });
    }
  });

type Normalized = {
  data: Prisma.ServiceUncheckedCreateInput;
};

function normalize(
  v: z.infer<typeof schema>
): Normalized {
  const isFixed = v.billingModel === "fixed";
  const isMonthly = v.billingCycle === "monthly";
  const renewalDate =
    !isMonthly && v.renewalDate ? new Date(`${v.renewalDate}T00:00:00.000Z`) : null;
  const billingDay = isMonthly ? (v.billingDay ?? null) : null;

  const prepaidUntil = v.prepaidUntil
    ? new Date(`${v.prepaidUntil}T00:00:00.000Z`)
    : null;

  const nextPaymentDate = computeNextPaymentDate(
    { billingCycle: v.billingCycle, billingDay, renewalDate, prepaidUntil },
    new Date()
  );

  const tags = (v.tags ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  return {
    data: {
      kind: v.kind,
      registrar: v.registrar || null,
      autoRenew: v.autoRenew,
      name: v.name,
      vendorUrl: v.vendorUrl || null,
      categoryId: v.categoryId || null,
      description: v.description || null,
      billingModel: v.billingModel,
      billingCycle: v.billingCycle,
      price: new Prisma.Decimal(v.billingModel === "per_seat" ? 0 : v.price),
      seatPriceDefault: isFixed
        ? null
        : new Prisma.Decimal(v.seatPriceDefault ?? 0),
      currency: v.currency,
      billingDay,
      renewalDate,
      prepaidUntil,
      nextPaymentDate,
      paymentMethodId: v.paymentMethodId || null,
      ownerId: v.ownerId,
      backupOwnerId: v.backupOwnerId || null,
      status: v.status,
      cancellationNoticeDays: v.cancellationNoticeDays,
      tags,
      notes: v.notes || null,
    },
  };
}

function parseForm(formData: FormData) {
  return schema.safeParse({
    kind: formData.get("kind") ?? "service",
    registrar: formData.get("registrar") ?? "",
    autoRenew: formData.get("autoRenew") === "on" || formData.get("autoRenew") === "true",
    name: formData.get("name"),
    vendorUrl: formData.get("vendorUrl") ?? "",
    categoryId: formData.get("categoryId") ?? "",
    description: formData.get("description") ?? "",
    billingModel: formData.get("billingModel"),
    billingCycle: formData.get("billingCycle"),
    price: formData.get("price") ?? 0,
    seatPriceDefault: formData.get("seatPriceDefault") || undefined,
    currency: formData.get("currency"),
    billingDay: formData.get("billingDay") || undefined,
    renewalDate: formData.get("renewalDate") ?? "",
    prepaidUntil: formData.get("prepaidUntil") ?? "",
    paymentMethodId: formData.get("paymentMethodId") ?? "",
    ownerId: formData.get("ownerId"),
    backupOwnerId: formData.get("backupOwnerId") ?? "",
    status: formData.get("status") ?? "active",
    cancellationNoticeDays: formData.get("cancellationNoticeDays") ?? 30,
    tags: formData.get("tags") ?? "",
    notes: formData.get("notes") ?? "",
  });
}


/**
 * Закрывает ожидаемые строки плана, попавшие в оплаченный вперёд период.
 * Только с начала текущего месяца — историю прошлых месяцев не переписываем
 * (§3.8), иначе честная просрочка задним числом превратилась бы в «waived».
 */
async function waivePrepaidExpectedLines(
  serviceId: string,
  prepaidUntil: Date
): Promise<number> {
  const res = await prisma.planLine.updateMany({
    where: {
      serviceId,
      status: "expected",
      expectedDate: { gte: appMonthStart(), lte: prepaidUntil },
    },
    data: {
      status: "waived",
      comment: `Оплачено вперёд до ${prepaidUntil.toISOString().slice(0, 10)}`,
    },
  });
  return res.count;
}

export async function createService(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    const actor = await requireManager();
    const parsed = parseForm(formData);
    if (!parsed.success) return fail(parsed.error.issues[0]!.message);

    const { data } = normalize(parsed.data);
    const created = await prisma.service.create({ data });
    await writeAudit({
      entity: "Service",
      entityId: created.id,
      actor: actor.email ?? actor.id,
      action: "create",
      diff: buildDiff(null, created, [...AUDIT_FIELDS]),
    });
    revalidatePath("/services");
    return ok("Сервис создан");
  } catch (e) {
    return toError(e, "создать сервис");
  }
}

export async function updateService(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    const actor = await requireManager();
    const id = String(formData.get("id") ?? "");
    if (!id) return fail("Не указан идентификатор");
    const parsed = parseForm(formData);
    if (!parsed.success) return fail(parsed.error.issues[0]!.message);

    const before = await prisma.service.findUnique({ where: { id } });
    if (!before) return fail("Сервис не найден");

    const { data } = normalize(parsed.data);
    const updated = await prisma.service.update({ where: { id }, data });

    // Если через форму выставили/продлили «оплачено вперёд» — закрываем
    // ожидания в оплаченном периоде (иначе они уйдут в ложную просрочку).
    let waivedCount = 0;
    if (
      updated.prepaidUntil &&
      updated.prepaidUntil.getTime() !== (before.prepaidUntil?.getTime() ?? 0)
    ) {
      waivedCount = await waivePrepaidExpectedLines(id, updated.prepaidUntil);
    }

    await writeAudit({
      entity: "Service",
      entityId: id,
      actor: actor.email ?? actor.id,
      action: "update",
      diff: {
        ...buildDiff(before, updated, [...AUDIT_FIELDS]),
        ...(waivedCount > 0 ? { waived_plan_lines: waivedCount } : {}),
      },
    });
    revalidatePath("/services");
    revalidatePath(`/services/${id}`);
    return ok("Сервис обновлён");
  } catch (e) {
    return toError(e, "обновить сервис");
  }
}

export async function setServiceArchived(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    const actor = await requireManager();
    const id = String(formData.get("id") ?? "");
    const archived = String(formData.get("archived") ?? "") === "true";
    if (!id) return fail("Не указан идентификатор");

    const before = await prisma.service.findUnique({ where: { id } });
    if (!before) return fail("Сервис не найден");

    const updated = await prisma.service.update({
      where: { id },
      data: { status: archived ? "archived" : "active" },
    });
    await writeAudit({
      entity: "Service",
      entityId: id,
      actor: actor.email ?? actor.id,
      action: archived ? "archive" : "unarchive",
      diff: buildDiff(before, updated, ["status"]),
    });
    revalidatePath("/services");
    revalidatePath(`/services/${id}`);
    return ok(archived ? "Сервис архивирован" : "Сервис возвращён из архива");
  } catch (e) {
    return toError(e, "изменить статус сервиса");
  }
}

function toError(e: unknown, verb: string): ActionResult {
  if (e instanceof AuthorizationError) return fail(e.message);
  console.error(`Не удалось ${verb}:`, e);
  return fail(`Не удалось ${verb}`);
}

/**
 * «Отложить оплату»: сервис проплачен вперёд до указанной даты.
 * Ставит `prepaidUntil`, пересчитывает следующую дату платежа и закрывает уже
 * сгенерированные ожидаемые строки плана, попавшие в оплаченный период.
 *
 * План задним числом НЕ переписывается (§3.8): суммы и даты строк остаются,
 * меняется только статус на `waived` с комментарием — это ровно тот случай,
 * для которого waived и предназначен («списания не было — это нормально»).
 */
export async function setServicePrepaidUntil(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    const actor = await requireManager();
    const id = String(formData.get("id") ?? "");
    const raw = String(formData.get("prepaidUntil") ?? "").trim();
    if (!id) return fail("Не указан сервис");

    const before = await prisma.service.findUnique({ where: { id } });
    if (!before) return fail("Сервис не найден");

    if (!raw) {
      // Снять отсрочку.
      const updated = await prisma.service.update({
        where: { id },
        data: {
          prepaidUntil: null,
          nextPaymentDate: computeNextPaymentDate(
            {
              billingCycle: before.billingCycle,
              billingDay: before.billingDay,
              renewalDate: before.renewalDate,
              prepaidUntil: null,
            },
            new Date()
          ),
        },
      });
      await writeAudit({
        entity: "Service",
        entityId: id,
        actor: actor.email ?? actor.id,
        action: "unset_prepaid",
        diff: buildDiff(before, updated, ["prepaidUntil"]),
      });
      revalidatePath("/");
      revalidatePath("/services");
      revalidatePath(`/services/${id}`);
      return ok("Отсрочка снята");
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return fail("Некорректная дата");
    const prepaidUntil = new Date(`${raw}T00:00:00.000Z`);

    const updated = await prisma.service.update({
      where: { id },
      data: {
        prepaidUntil,
        nextPaymentDate: computeNextPaymentDate(
          {
            billingCycle: before.billingCycle,
            billingDay: before.billingDay,
            renewalDate: before.renewalDate,
            prepaidUntil,
          },
          new Date()
        ),
      },
    });

    const waivedCount = await waivePrepaidExpectedLines(id, prepaidUntil);

    await writeAudit({
      entity: "Service",
      entityId: id,
      actor: actor.email ?? actor.id,
      action: "set_prepaid",
      diff: {
        ...buildDiff(before, updated, ["prepaidUntil", "nextPaymentDate"]),
        waived_plan_lines: waivedCount,
      },
    });

    revalidatePath("/");
    revalidatePath("/services");
    revalidatePath(`/services/${id}`);
    revalidatePath("/reports");
    return ok(
      waivedCount > 0
        ? `Оплачено вперёд до ${raw}; закрыто ожиданий: ${waivedCount}`
        : `Оплачено вперёд до ${raw}`
    );
  } catch (e) {
    return toError(e, "установить отсрочку оплаты");
  }
}
