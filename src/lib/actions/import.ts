"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireManager, AuthorizationError } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { parseCsv } from "@/lib/csv/parse";
import { partitionUnique } from "@/lib/csv/dedup";
import { computeNextPaymentDate } from "@/lib/calc/dates";
import { convert, type RateRecord } from "@/lib/calc/fx";
import { SUPPORTED_CURRENCIES } from "@/lib/currencies";

export type ImportResult =
  | {
      ok: true;
      created: number;
      skippedDuplicates: number;
      errors: string[];
    }
  | { ok: false; error: string };

function pick(rec: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    const found = Object.keys(rec).find(
      (h) => h.trim().toLowerCase() === k.toLowerCase()
    );
    if (found && rec[found] != null && rec[found] !== "") return rec[found]!;
  }
  return "";
}

// ── Импорт сервисов ──────────────────────────────────────────────────────────

export async function importServicesCsv(
  _prev: ImportResult | null,
  formData: FormData
): Promise<ImportResult> {
  try {
    const actor = await requireManager();
    const text = String(formData.get("csv") ?? "");
    const { records } = parseCsv(text);
    if (records.length === 0) return { ok: false, error: "Пустой CSV" };

    const [users, categories, existing] = await Promise.all([
      prisma.user.findMany({ select: { id: true, email: true } }),
      prisma.category.findMany({ select: { id: true, name: true } }),
      prisma.service.findMany({ select: { name: true } }),
    ]);
    const userByEmail = new Map(
      users.filter((u) => u.email).map((u) => [u.email!.toLowerCase(), u.id])
    );
    const catByName = new Map(
      categories.map((c) => [c.name.toLowerCase(), c.id])
    );

    const { unique, duplicates } = partitionUnique(
      records,
      (r) => pick(r, "name"),
      existing.map((e) => e.name)
    );

    const errors: string[] = [];
    let created = 0;

    for (const [idx, rec] of unique.entries()) {
      const name = pick(rec, "name");
      if (!name) {
        errors.push(`Строка ${idx + 1}: пустое название`);
        continue;
      }
      const billingModel = pick(rec, "billing_model", "billingModel", "модель");
      const billingCycle = pick(rec, "billing_cycle", "billingCycle", "цикл");
      if (!["fixed", "per_seat", "hybrid"].includes(billingModel)) {
        errors.push(`«${name}»: некорректная billing_model`);
        continue;
      }
      if (!["monthly", "yearly"].includes(billingCycle)) {
        errors.push(`«${name}»: некорректный billing_cycle`);
        continue;
      }
      const ownerEmail = pick(rec, "owner_email", "ownerEmail", "ответственный").toLowerCase();
      const ownerId = userByEmail.get(ownerEmail);
      if (!ownerId) {
        errors.push(`«${name}»: ответственный ${ownerEmail || "—"} не найден`);
        continue;
      }
      const currency = pick(rec, "currency", "валюта") || "USD";
      const price = Number(pick(rec, "price", "цена") || "0");
      const seatPrice = pick(rec, "seat_price", "seatPriceDefault", "цена_места");
      const billingDayStr = pick(rec, "billing_day", "billingDay", "день");
      const renewalStr = pick(rec, "renewal_date", "renewalDate", "дата_продления");
      const categoryId = catByName.get(pick(rec, "category", "категория").toLowerCase()) ?? null;

      const billingDay =
        billingCycle === "monthly" && billingDayStr
          ? Math.max(1, Math.min(31, Number(billingDayStr)))
          : null;
      const renewalDate =
        billingCycle === "yearly" && renewalStr
          ? new Date(`${renewalStr}T00:00:00.000Z`)
          : null;
      const nextPaymentDate = computeNextPaymentDate(
        { billingCycle: billingCycle as "monthly" | "yearly", billingDay, renewalDate },
        new Date()
      );

      try {
        const svc = await prisma.service.create({
          data: {
            name,
            billingModel: billingModel as Prisma.ServiceCreateInput["billingModel"],
            billingCycle: billingCycle as Prisma.ServiceCreateInput["billingCycle"],
            price: new Prisma.Decimal(billingModel === "per_seat" ? 0 : price || 0),
            seatPriceDefault:
              billingModel === "fixed" || !seatPrice
                ? null
                : new Prisma.Decimal(seatPrice),
            currency,
            billingDay,
            renewalDate,
            nextPaymentDate,
            categoryId,
            ownerId,
          },
        });
        created++;
        await writeAudit({
          entity: "Service",
          entityId: svc.id,
          actor: actor.email ?? actor.id,
          action: "import",
          diff: { name, source: "csv" },
        });
      } catch (e) {
        errors.push(`«${name}»: ошибка вставки`);
        console.error("import service:", e);
      }
    }

    revalidatePath("/services");
    return {
      ok: true,
      created,
      skippedDuplicates: duplicates.length,
      errors,
    };
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false, error: e.message };
    console.error("importServicesCsv:", e);
    return { ok: false, error: "Не удалось импортировать сервисы" };
  }
}

// ── Импорт мест ──────────────────────────────────────────────────────────────

export async function importSeatsCsv(
  _prev: ImportResult | null,
  formData: FormData
): Promise<ImportResult> {
  try {
    const actor = await requireManager();
    const text = String(formData.get("csv") ?? "");
    const { records } = parseCsv(text);
    if (records.length === 0) return { ok: false, error: "Пустой CSV" };

    const services = await prisma.service.findMany({
      select: { id: true, name: true, seatPriceDefault: true, billingModel: true },
    });
    const svcByName = new Map(
      services.map((s) => [s.name.toLowerCase(), s])
    );

    // Существующие активные места: ключ serviceId|email.
    const activeSeats = await prisma.seat.findMany({
      where: { endedAt: null },
      select: { serviceId: true, employee: { select: { email: true } } },
    });
    const existingKeys = activeSeats.map(
      (s) => `${s.serviceId}|${s.employee.email.toLowerCase()}`
    );

    // Ключ строки файла: serviceId|email (резолвим сервис для ключа).
    const withKey = records
      .map((r) => {
        const svc = svcByName.get(pick(r, "service", "сервис").toLowerCase());
        const email = pick(r, "email", "почта").toLowerCase();
        return { rec: r, svc, email };
      });

    const { unique, duplicates } = partitionUnique(
      withKey,
      (x) => (x.svc ? `${x.svc.id}|${x.email}` : `?|${x.email}`),
      existingKeys
    );

    const errors: string[] = [];
    let created = 0;

    for (const { rec, svc, email } of unique) {
      if (!svc) {
        errors.push(`Сервис «${pick(rec, "service", "сервис")}» не найден`);
        continue;
      }
      if (svc.billingModel === "fixed") {
        errors.push(`«${svc.name}»: fixed-сервис не имеет мест`);
        continue;
      }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        errors.push(`Некорректный email: ${email || "—"}`);
        continue;
      }
      const seatPriceStr = pick(rec, "seat_price", "seatPrice", "цена");
      const seatPrice =
        seatPriceStr !== ""
          ? new Prisma.Decimal(seatPriceStr)
          : (svc.seatPriceDefault ?? new Prisma.Decimal(0));

      try {
        await prisma.$transaction(async (tx) => {
          let employee = await tx.employee.findUnique({ where: { email } });
          if (!employee) {
            employee = await tx.employee.create({
              data: {
                email,
                fullName: pick(rec, "full_name", "fullName", "имя") || email.split("@")[0]!,
              },
            });
          }
          await tx.seat.create({
            data: { serviceId: svc.id, employeeId: employee.id, seatPrice },
          });
        });
        created++;
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === "P2002"
        ) {
          errors.push(`«${svc.name}» / ${email}: место уже активно`);
        } else {
          errors.push(`«${svc.name}» / ${email}: ошибка вставки`);
          console.error("import seat:", e);
        }
      }
    }

    await writeAudit({
      entity: "Seat",
      entityId: "csv-import",
      actor: actor.email ?? actor.id,
      action: "import",
      diff: { created, source: "csv" },
    });

    revalidatePath("/services");
    revalidatePath("/employees");
    return { ok: true, created, skippedDuplicates: duplicates.length, errors };
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false, error: e.message };
    console.error("importSeatsCsv:", e);
    return { ok: false, error: "Не удалось импортировать места" };
  }
}

// ── Импорт платежей ──────────────────────────────────────────────────────────

export async function importPaymentsCsv(
  _prev: ImportResult | null,
  formData: FormData
): Promise<ImportResult> {
  try {
    const actor = await requireManager();
    const text = String(formData.get("csv") ?? "");
    const { records } = parseCsv(text);
    if (records.length === 0) return { ok: false, error: "Пустой CSV" };

    const [services, settings, ratesRaw, existingPayments] = await Promise.all([
      prisma.service.findMany({ select: { id: true, name: true, currency: true } }),
      prisma.setting.upsert({
        where: { id: "singleton" },
        update: {},
        create: { id: "singleton" },
      }),
      prisma.fxRate.findMany(),
      prisma.payment.findMany({
        select: { serviceId: true, paidAt: true, amount: true, currency: true },
      }),
    ]);
    const base = settings.baseCurrency;
    const rates: RateRecord[] = ratesRaw.map((r) => ({
      date: r.date,
      from: r.from,
      to: r.to,
      rate: r.rate,
    }));
    const svcByName = new Map(services.map((s) => [s.name.toLowerCase(), s]));

    const dupKey = (serviceId: string, paidAt: string, amount: string, cur: string) =>
      `${serviceId}|${paidAt}|${Number(amount)}|${cur}`;
    const existingKeys = existingPayments.map((p) =>
      dupKey(
        p.serviceId,
        p.paidAt.toISOString().slice(0, 10),
        p.amount.toString(),
        p.currency
      )
    );

    const withMeta = records.map((r) => {
      const svc = svcByName.get(pick(r, "service", "сервис").toLowerCase());
      const paidAt = pick(r, "paid_at", "paidAt", "дата");
      const amount = pick(r, "amount", "сумма");
      const currency = pick(r, "currency", "валюта") || svc?.currency || base;
      return { rec: r, svc, paidAt, amount, currency };
    });

    const { unique, duplicates } = partitionUnique(
      withMeta,
      (x) =>
        x.svc ? dupKey(x.svc.id, x.paidAt, x.amount, x.currency) : `?|${x.paidAt}`,
      existingKeys
    );

    const errors: string[] = [];
    let created = 0;
    for (const { rec, svc, paidAt, amount, currency } of unique) {
      if (!svc) {
        errors.push(`Сервис «${pick(rec, "service", "сервис")}» не найден`);
        continue;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(paidAt)) {
        errors.push(`Некорректная дата: ${paidAt || "—"}`);
        continue;
      }
      if (!SUPPORTED_CURRENCIES.includes(currency as never)) {
        errors.push(`Неизвестная валюта: ${currency}`);
        continue;
      }
      const amt = Number(amount);
      if (!(amt > 0)) {
        errors.push(`«${svc.name}»: некорректная сумма`);
        continue;
      }
      const paidAtDate = new Date(`${paidAt}T00:00:00.000Z`);
      const amountDec = new Prisma.Decimal(amt);
      const amountBase =
        convert(amountDec, currency, base, paidAtDate, rates) ?? amountDec;
      try {
        const payment = await prisma.payment.create({
          data: {
            serviceId: svc.id,
            paidAt: paidAtDate,
            amount: amountDec,
            currency,
            amountBase,
            source: "csv_import",
            comment: pick(rec, "comment", "комментарий") || null,
            invoiceUrl: pick(rec, "invoice_url", "invoiceUrl") || null,
          },
        });
        created++;
        await writeAudit({
          entity: "Payment",
          entityId: payment.id,
          actor: actor.email ?? actor.id,
          action: "import",
          diff: { amount: amountDec.toString(), currency, source: "csv" },
        });
      } catch {
        errors.push(`«${svc.name}» ${paidAt}: ошибка вставки`);
      }
    }

    revalidatePath("/");
    revalidatePath("/reports");
    return { ok: true, created, skippedDuplicates: duplicates.length, errors };
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false, error: e.message };
    console.error("importPaymentsCsv:", e);
    return { ok: false, error: "Не удалось импортировать платежи" };
  }
}
