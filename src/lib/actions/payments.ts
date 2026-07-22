"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireManager, AuthorizationError } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { convert, type RateRecord } from "@/lib/calc/fx";
import { SUPPORTED_CURRENCIES } from "@/lib/currencies";
import { type ActionResult, ok, fail } from "@/lib/actions/types";

async function baseAndRates(): Promise<{ base: string; rates: RateRecord[] }> {
  const [settings, rates] = await Promise.all([
    prisma.setting.upsert({
      where: { id: "singleton" },
      update: {},
      create: { id: "singleton" },
    }),
    prisma.fxRate.findMany(),
  ]);
  return {
    base: settings.baseCurrency,
    rates: rates.map((r) => ({ date: r.date, from: r.from, to: r.to, rate: r.rate })),
  };
}

/** amount_base фиксируется по курсу даты платежа (§3.7). */
function amountBaseFor(
  amount: Prisma.Decimal,
  currency: string,
  base: string,
  paidAt: Date,
  rates: RateRecord[]
): Prisma.Decimal {
  return convert(amount, currency, base, paidAt, rates) ?? amount;
}

// ── Подтверждение ожидаемого списания ────────────────────────────────────────

const confirmSchema = z.object({
  planLineId: z.string().min(1),
  amount: z.coerce.number().min(0).optional(),
  paidAt: z.string().optional().or(z.literal("")),
  comment: z.string().trim().max(500).optional().or(z.literal("")),
});

export async function confirmExpectedPayment(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    const actor = await requireManager();
    const parsed = confirmSchema.safeParse({
      planLineId: formData.get("planLineId"),
      amount: formData.get("amount") || undefined,
      paidAt: formData.get("paidAt") ?? "",
      comment: formData.get("comment") ?? "",
    });
    if (!parsed.success) return fail(parsed.error.issues[0]!.message);

    const line = await prisma.planLine.findUnique({
      where: { id: parsed.data.planLineId },
    });
    if (!line) return fail("Строка плана не найдена");
    if (line.status !== "expected")
      return fail("Эта строка плана уже обработана");

    const amount = new Prisma.Decimal(
      parsed.data.amount ?? line.expectedAmount
    );
    const paidAt = parsed.data.paidAt
      ? new Date(`${parsed.data.paidAt}T00:00:00.000Z`)
      : line.expectedDate;

    const { base, rates } = await baseAndRates();
    const amountBase = amountBaseFor(amount, line.currency, base, paidAt, rates);

    await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          serviceId: line.serviceId,
          paidAt,
          amount,
          currency: line.currency,
          amountBase,
          source: "confirmed_expected",
          planLineId: line.id,
          comment: parsed.data.comment || null,
        },
      });
      await tx.planLine.update({
        where: { id: line.id },
        data: { status: "confirmed" },
      });
      await writeAudit(
        {
          entity: "Payment",
          entityId: payment.id,
          actor: actor.email ?? actor.id,
          action: "confirm_expected",
          diff: {
            planLineId: line.id,
            amount: amount.toString(),
            expectedAmount: line.expectedAmount.toString(),
            currency: line.currency,
            paidAt: paidAt.toISOString(),
          },
        },
        tx
      );
    });

    revalidatePath("/");
    revalidatePath("/reports");
    revalidatePath(`/services/${line.serviceId}`);
    return ok("Списание подтверждено");
  } catch (e) {
    return toError(e, "подтвердить списание");
  }
}

// ── Ручное добавление платежа ────────────────────────────────────────────────

const manualSchema = z.object({
  serviceId: z.string().min(1),
  amount: z.coerce.number().positive("Сумма должна быть > 0"),
  currency: z.enum(SUPPORTED_CURRENCIES),
  paidAt: z.string().min(1, "Укажите дату"),
  comment: z.string().trim().max(500).optional().or(z.literal("")),
  invoiceUrl: z.string().trim().max(500).optional().or(z.literal("")),
});

export async function recordManualPayment(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    const actor = await requireManager();
    const parsed = manualSchema.safeParse({
      serviceId: formData.get("serviceId"),
      amount: formData.get("amount"),
      currency: formData.get("currency"),
      paidAt: formData.get("paidAt"),
      comment: formData.get("comment") ?? "",
      invoiceUrl: formData.get("invoiceUrl") ?? "",
    });
    if (!parsed.success) return fail(parsed.error.issues[0]!.message);

    const service = await prisma.service.findUnique({
      where: { id: parsed.data.serviceId },
    });
    if (!service) return fail("Сервис не найден");

    const amount = new Prisma.Decimal(parsed.data.amount);
    const paidAt = new Date(`${parsed.data.paidAt}T00:00:00.000Z`);
    const { base, rates } = await baseAndRates();
    const amountBase = amountBaseFor(
      amount,
      parsed.data.currency,
      base,
      paidAt,
      rates
    );

    const payment = await prisma.payment.create({
      data: {
        serviceId: parsed.data.serviceId,
        paidAt,
        amount,
        currency: parsed.data.currency,
        amountBase,
        source: "manual",
        comment: parsed.data.comment || null,
        invoiceUrl: parsed.data.invoiceUrl || null,
      },
    });
    await writeAudit({
      entity: "Payment",
      entityId: payment.id,
      actor: actor.email ?? actor.id,
      action: "create",
      diff: {
        amount: amount.toString(),
        currency: parsed.data.currency,
        paidAt: paidAt.toISOString(),
        source: "manual",
      },
    });

    revalidatePath("/");
    revalidatePath("/reports");
    revalidatePath(`/services/${parsed.data.serviceId}`);
    return ok("Платёж добавлен");
  } catch (e) {
    return toError(e, "добавить платёж");
  }
}

// ── Пометка строки плана «waived» ────────────────────────────────────────────

export async function waivePlanLine(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    const actor = await requireManager();
    const planLineId = String(formData.get("planLineId") ?? "");
    const comment = String(formData.get("comment") ?? "").trim();
    if (!planLineId) return fail("Не указана строка плана");

    const line = await prisma.planLine.findUnique({ where: { id: planLineId } });
    if (!line) return fail("Строка плана не найдена");
    if (line.status === "confirmed")
      return fail("Строка уже подтверждена платежом");

    await prisma.planLine.update({
      where: { id: planLineId },
      data: { status: "waived", comment: comment || null },
    });
    await writeAudit({
      entity: "PlanLine",
      entityId: planLineId,
      actor: actor.email ?? actor.id,
      action: "waive",
      diff: { status: { from: line.status, to: "waived" }, comment },
    });

    revalidatePath("/");
    revalidatePath("/reports");
    revalidatePath(`/services/${line.serviceId}`);
    return ok("Строка помечена «списания не было»");
  } catch (e) {
    return toError(e, "пометить строку");
  }
}

function toError(e: unknown, verb: string): ActionResult {
  if (e instanceof AuthorizationError) return fail(e.message);
  console.error(`Не удалось ${verb}:`, e);
  return fail(`Не удалось ${verb}`);
}
