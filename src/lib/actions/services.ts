"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireManager, AuthorizationError } from "@/lib/authz";
import { writeAudit, buildDiff } from "@/lib/audit";
import { computeNextPaymentDate } from "@/lib/calc/dates";
import { SUPPORTED_CURRENCIES } from "@/lib/currencies";
import { type ActionResult, ok, fail } from "@/lib/actions/types";

const AUDIT_FIELDS = [
  "name",
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
    billingModel: z.enum(["fixed", "per_seat", "hybrid"]),
    billingCycle: z.enum(["monthly", "yearly"]),
    price: z.coerce.number().min(0).default(0),
    seatPriceDefault: z.coerce.number().min(0).optional(),
    currency: z.enum(SUPPORTED_CURRENCIES),
    billingDay: z.coerce.number().int().min(1).max(31).optional(),
    renewalDate: z.string().trim().optional().or(z.literal("")),
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

  const nextPaymentDate = computeNextPaymentDate(
    { billingCycle: v.billingCycle, billingDay, renewalDate },
    new Date()
  );

  const tags = (v.tags ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  return {
    data: {
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
    paymentMethodId: formData.get("paymentMethodId") ?? "",
    ownerId: formData.get("ownerId"),
    backupOwnerId: formData.get("backupOwnerId") ?? "",
    status: formData.get("status") ?? "active",
    cancellationNoticeDays: formData.get("cancellationNoticeDays") ?? 30,
    tags: formData.get("tags") ?? "",
    notes: formData.get("notes") ?? "",
  });
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
    await writeAudit({
      entity: "Service",
      entityId: id,
      actor: actor.email ?? actor.id,
      action: "update",
      diff: buildDiff(before, updated, [...AUDIT_FIELDS]),
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
