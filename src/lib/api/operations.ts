import { Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireApiRole, ApiError } from "@/lib/api/authz";
import type { ApiActor } from "@/lib/api/token";
import { writeAudit } from "@/lib/audit";
import { serviceMonthlyRunRate, normalizeToMonthly } from "@/lib/calc/service-cost";
import { convert, type RateRecord } from "@/lib/calc/fx";
import { computeNextPaymentDate } from "@/lib/calc/dates";
import { getMonthlyReport as buildReport, type ReportView } from "@/lib/report/monthly-report";
import { getExpectedCharges } from "@/lib/plan/expected-charges";
import { forecastToEndOfMonth } from "@/lib/plan/forecast";
import { SUPPORTED_CURRENCIES } from "@/lib/currencies";

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
const toBase = (
  amount: Prisma.Decimal | number | string,
  currency: string,
  base: string,
  rates: RateRecord[],
  on: Date
) => convert(amount, currency, base, on, rates) ?? new Prisma.Decimal(amount);

const money = (d: Prisma.Decimal) => Number(d.toFixed(2));

// ── whoami / overview ────────────────────────────────────────────────────────

export function whoami(actor: ApiActor) {
  return { name: actor.tokenName, role: actor.role };
}

export async function overview(_actor: ApiActor) {
  const now = new Date();
  const { base, rates } = await baseAndRates();
  const [services, forecast, expected] = await Promise.all([
    prisma.service.findMany({
      where: { status: "active" },
      include: { seats: { where: { endedAt: null } } },
    }),
    forecastToEndOfMonth(now),
    getExpectedCharges(now),
  ]);
  let runRate = new Prisma.Decimal(0);
  let seats = 0;
  for (const s of services) {
    seats += s.seats.length;
    runRate = runRate.add(
      toBase(
        serviceMonthlyRunRate({
          billingModel: s.billingModel,
          billingCycle: s.billingCycle,
          price: s.price,
          seats: s.seats,
        }),
        s.currency,
        base,
        rates,
        now
      )
    );
  }
  return {
    base,
    run_rate_monthly: money(runRate),
    active_services: services.length,
    active_seats: seats,
    forecast_month_total: money(forecast.monthTotal),
    forecast_remaining: money(forecast.remaining),
    upcoming_count: expected.charges.length,
    overdue_count: expected.charges.filter((c) => c.overdue).length,
  };
}

// ── services ─────────────────────────────────────────────────────────────────

const serviceCard = (s: {
  id: string;
  name: string;
  vendorUrl: string | null;
  billingModel: string;
  billingCycle: string;
  currency: string;
  status: string;
  price: Prisma.Decimal;
  seatPriceDefault: Prisma.Decimal | null;
  nextPaymentDate: Date | null;
  category?: { name: string } | null;
  owner?: { name: string | null; email: string | null };
  seats?: { seatPrice: Prisma.Decimal }[];
}) => ({
  id: s.id,
  name: s.name,
  vendor_url: s.vendorUrl,
  billing_model: s.billingModel,
  billing_cycle: s.billingCycle,
  currency: s.currency,
  status: s.status,
  price: s.price.toString(),
  seat_price_default: s.seatPriceDefault?.toString() ?? null,
  next_payment_date: s.nextPaymentDate?.toISOString().slice(0, 10) ?? null,
  category: s.category?.name ?? null,
  owner: s.owner ? (s.owner.name ?? s.owner.email) : undefined,
  seats_count: s.seats?.length,
  run_rate_monthly: s.seats
    ? serviceMonthlyRunRate({
        billingModel: s.billingModel as "fixed" | "per_seat" | "hybrid",
        billingCycle: s.billingCycle as "monthly" | "yearly",
        price: s.price,
        seats: s.seats,
      }).toFixed(2)
    : undefined,
});

export async function listServices(
  _actor: ApiActor,
  params: { status?: string; category?: string; owner?: string; q?: string }
) {
  const where: Prisma.ServiceWhereInput = {};
  if (params.status) where.status = params.status as Prisma.ServiceWhereInput["status"];
  if (params.category) where.category = { name: { equals: params.category, mode: "insensitive" } };
  if (params.owner)
    where.owner = {
      OR: [
        { email: { equals: params.owner, mode: "insensitive" } },
        { name: { contains: params.owner, mode: "insensitive" } },
      ],
    };
  if (params.q) where.name = { contains: params.q, mode: "insensitive" };

  const services = await prisma.service.findMany({
    where,
    include: { category: true, owner: true, seats: { where: { endedAt: null } } },
    orderBy: { name: "asc" },
  });
  return services.map(serviceCard);
}

export async function getService(_actor: ApiActor, id: string) {
  const s = await prisma.service.findUnique({
    where: { id },
    include: {
      category: true,
      owner: true,
      seats: { where: { endedAt: null }, include: { employee: true } },
    },
  });
  if (!s) throw new ApiError(404, "Сервис не найден");
  return {
    ...serviceCard(s),
    seats: s.seats.map((seat) => ({
      id: seat.id,
      email: seat.employee.email,
      full_name: seat.employee.fullName,
      seat_price: seat.seatPrice.toString(),
    })),
  };
}

const serviceInput = z.object({
  name: z.string().trim().min(1).max(120),
  vendor_url: z.string().trim().optional(),
  category: z.string().trim().optional(),
  billing_model: z.enum(["fixed", "per_seat", "hybrid"]),
  billing_cycle: z.enum(["monthly", "yearly"]),
  price: z.coerce.number().min(0).default(0),
  seat_price_default: z.coerce.number().min(0).optional(),
  currency: z.enum(SUPPORTED_CURRENCIES),
  billing_day: z.coerce.number().int().min(1).max(31).optional(),
  renewal_date: z.string().trim().optional(),
  owner_email: z.string().trim().email(),
  status: z.enum(["active", "paused", "cancelled", "archived"]).default("active"),
});

async function resolveServiceData(input: z.infer<typeof serviceInput>) {
  const owner = await prisma.user.findFirst({
    where: { email: { equals: input.owner_email, mode: "insensitive" } },
  });
  if (!owner) throw new ApiError(400, `Ответственный ${input.owner_email} не найден`);
  const category = input.category
    ? await prisma.category.findFirst({
        where: { name: { equals: input.category, mode: "insensitive" } },
      })
    : null;
  const isFixed = input.billing_model === "fixed";
  const isMonthly = input.billing_cycle === "monthly";
  const billingDay = isMonthly ? (input.billing_day ?? null) : null;
  const renewalDate =
    !isMonthly && input.renewal_date
      ? new Date(`${input.renewal_date}T00:00:00.000Z`)
      : null;
  if (isMonthly && billingDay == null)
    throw new ApiError(400, "monthly: нужен billing_day");
  if (!isMonthly && !renewalDate)
    throw new ApiError(400, "yearly: нужен renewal_date");
  return {
    name: input.name,
    vendorUrl: input.vendor_url || null,
    categoryId: category?.id ?? null,
    billingModel: input.billing_model,
    billingCycle: input.billing_cycle,
    price: new Prisma.Decimal(input.billing_model === "per_seat" ? 0 : input.price),
    seatPriceDefault:
      isFixed || input.seat_price_default == null
        ? null
        : new Prisma.Decimal(input.seat_price_default),
    currency: input.currency,
    billingDay,
    renewalDate,
    nextPaymentDate: computeNextPaymentDate(
      { billingCycle: input.billing_cycle, billingDay, renewalDate },
      new Date()
    ),
    ownerId: owner.id,
    status: input.status,
  } satisfies Prisma.ServiceUncheckedCreateInput;
}

export async function createService(actor: ApiActor, body: unknown) {
  requireApiRole(actor, "manager");
  const parsed = serviceInput.safeParse(body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]!.message);
  const data = await resolveServiceData(parsed.data);
  const created = await prisma.service.create({ data });
  await writeAudit({
    entity: "Service",
    entityId: created.id,
    actor: actor.tokenName,
    action: "create",
    diff: { name: created.name, source: "api" },
  });
  return serviceCard({ ...created, category: null });
}

export async function updateService(actor: ApiActor, id: string, body: unknown) {
  requireApiRole(actor, "manager");
  const existing = await prisma.service.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Сервис не найден");
  // Принимаем полный объект (как при создании).
  const full = serviceInput.safeParse(body);
  if (!full.success) throw new ApiError(400, full.error.issues[0]!.message);
  const data = await resolveServiceData(full.data);
  const updated = await prisma.service.update({ where: { id }, data });
  await writeAudit({
    entity: "Service",
    entityId: id,
    actor: actor.tokenName,
    action: "update",
    diff: { source: "api" },
  });
  return serviceCard({ ...updated, category: null });
}

export async function setServiceArchived(
  actor: ApiActor,
  id: string,
  archived: boolean
) {
  requireApiRole(actor, "manager");
  const existing = await prisma.service.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Сервис не найден");
  const updated = await prisma.service.update({
    where: { id },
    data: { status: archived ? "archived" : "active" },
  });
  await writeAudit({
    entity: "Service",
    entityId: id,
    actor: actor.tokenName,
    action: archived ? "archive" : "unarchive",
    diff: { source: "api" },
  });
  return serviceCard({ ...updated, category: null });
}

// ── seats ────────────────────────────────────────────────────────────────────

export async function listSeats(
  _actor: ApiActor,
  params: { service_id?: string; email?: string }
) {
  const where: Prisma.SeatWhereInput = { endedAt: null };
  if (params.service_id) where.serviceId = params.service_id;
  if (params.email)
    where.employee = { email: { equals: params.email, mode: "insensitive" } };
  const seats = await prisma.seat.findMany({
    where,
    include: { employee: true, service: { select: { name: true, currency: true } } },
    orderBy: { startedAt: "desc" },
  });
  return seats.map((s) => ({
    id: s.id,
    service: s.service.name,
    email: s.employee.email,
    full_name: s.employee.fullName,
    seat_price: s.seatPrice.toString(),
    currency: s.service.currency,
    started_at: s.startedAt.toISOString().slice(0, 10),
  }));
}

export async function addSeat(actor: ApiActor, body: unknown) {
  requireApiRole(actor, "manager");
  const input = z
    .object({
      service_id: z.string().min(1),
      email: z.string().trim().toLowerCase().email(),
      full_name: z.string().trim().optional(),
      seat_price: z.coerce.number().min(0).optional(),
    })
    .safeParse(body);
  if (!input.success) throw new ApiError(400, input.error.issues[0]!.message);

  const service = await prisma.service.findUnique({
    where: { id: input.data.service_id },
  });
  if (!service) throw new ApiError(404, "Сервис не найден");
  if (service.billingModel === "fixed")
    throw new ApiError(400, "fixed-сервис не имеет мест");

  const price =
    input.data.seat_price != null
      ? new Prisma.Decimal(input.data.seat_price)
      : (service.seatPriceDefault ?? new Prisma.Decimal(0));

  try {
    const seat = await prisma.$transaction(async (tx) => {
      let employee = await tx.employee.findUnique({
        where: { email: input.data.email },
      });
      if (!employee) {
        employee = await tx.employee.create({
          data: {
            email: input.data.email,
            fullName: input.data.full_name || input.data.email.split("@")[0]!,
          },
        });
      }
      return tx.seat.create({
        data: {
          serviceId: service.id,
          employeeId: employee.id,
          seatPrice: price,
        },
      });
    });
    await writeAudit({
      entity: "Seat",
      entityId: seat.id,
      actor: actor.tokenName,
      action: "create",
      diff: { serviceId: service.id, email: input.data.email, source: "api" },
    });
    return { id: seat.id, service_id: service.id, email: input.data.email };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      throw new ApiError(409, "У сотрудника уже есть активное место");
    throw e;
  }
}

export async function endSeat(actor: ApiActor, seatId: string) {
  requireApiRole(actor, "manager");
  const seat = await prisma.seat.findUnique({ where: { id: seatId } });
  if (!seat) throw new ApiError(404, "Место не найдено");
  if (seat.endedAt) throw new ApiError(400, "Место уже закрыто");
  await prisma.seat.update({ where: { id: seatId }, data: { endedAt: new Date() } });
  await writeAudit({
    entity: "Seat",
    entityId: seatId,
    actor: actor.tokenName,
    action: "end",
    diff: { source: "api" },
  });
  return { id: seatId, ended: true };
}

// ── employees ────────────────────────────────────────────────────────────────

export async function listEmployees(_actor: ApiActor) {
  const employees = await prisma.employee.findMany({
    include: { seats: { where: { endedAt: null } } },
    orderBy: { fullName: "asc" },
  });
  return employees.map((e) => ({
    id: e.id,
    email: e.email,
    full_name: e.fullName,
    department: e.department,
    status: e.status,
    active_seats: e.seats.length,
  }));
}

export async function getEmployeeCosts(
  _actor: ApiActor,
  params: { id?: string; email?: string }
) {
  const employee = await prisma.employee.findFirst({
    where: params.id
      ? { id: params.id }
      : { email: { equals: params.email ?? "", mode: "insensitive" } },
    include: {
      seats: {
        where: { endedAt: null },
        include: { service: { select: { name: true, billingCycle: true, currency: true } } },
      },
    },
  });
  if (!employee) throw new ApiError(404, "Сотрудник не найден");
  const byCurrency = new Map<string, Prisma.Decimal>();
  const seats = employee.seats.map((s) => {
    const monthly = normalizeToMonthly(
      new Prisma.Decimal(s.seatPrice),
      s.service.billingCycle
    );
    byCurrency.set(
      s.service.currency,
      (byCurrency.get(s.service.currency) ?? new Prisma.Decimal(0)).add(monthly)
    );
    return {
      service: s.service.name,
      seat_price: s.seatPrice.toString(),
      monthly: monthly.toFixed(2),
      currency: s.service.currency,
    };
  });
  return {
    email: employee.email,
    full_name: employee.fullName,
    monthly_cost: [...byCurrency.entries()].map(([currency, amount]) => ({
      currency,
      amount: money(amount),
    })),
    seats,
  };
}

// ── payments ─────────────────────────────────────────────────────────────────

export async function recordPayment(actor: ApiActor, body: unknown) {
  requireApiRole(actor, "manager");
  const input = z
    .object({
      service_id: z.string().min(1),
      amount: z.coerce.number().positive(),
      currency: z.enum(SUPPORTED_CURRENCIES),
      paid_at: z.string().min(1),
      comment: z.string().trim().optional(),
    })
    .safeParse(body);
  if (!input.success) throw new ApiError(400, input.error.issues[0]!.message);

  const service = await prisma.service.findUnique({
    where: { id: input.data.service_id },
  });
  if (!service) throw new ApiError(404, "Сервис не найден");

  const { base, rates } = await baseAndRates();
  const paidAt = new Date(`${input.data.paid_at}T00:00:00.000Z`);
  const amount = new Prisma.Decimal(input.data.amount);
  const amountBase = toBase(amount, input.data.currency, base, rates, paidAt);

  const payment = await prisma.payment.create({
    data: {
      serviceId: service.id,
      paidAt,
      amount,
      currency: input.data.currency,
      amountBase,
      source: "manual",
      comment: input.data.comment || null,
    },
  });
  await writeAudit({
    entity: "Payment",
    entityId: payment.id,
    actor: actor.tokenName,
    action: "create",
    diff: { amount: amount.toString(), source: "api" },
  });
  return { id: payment.id, amount_base: money(amountBase), base };
}

export async function confirmExpectedPayment(actor: ApiActor, body: unknown) {
  requireApiRole(actor, "manager");
  const input = z
    .object({
      plan_line_id: z.string().min(1),
      amount: z.coerce.number().min(0).optional(),
      paid_at: z.string().optional(),
      comment: z.string().trim().optional(),
    })
    .safeParse(body);
  if (!input.success) throw new ApiError(400, input.error.issues[0]!.message);

  const line = await prisma.planLine.findUnique({
    where: { id: input.data.plan_line_id },
  });
  if (!line) throw new ApiError(404, "Строка плана не найдена");
  if (line.status !== "expected") throw new ApiError(400, "Строка уже обработана");

  const { base, rates } = await baseAndRates();
  const amount = new Prisma.Decimal(input.data.amount ?? line.expectedAmount);
  const paidAt = input.data.paid_at
    ? new Date(`${input.data.paid_at}T00:00:00.000Z`)
    : line.expectedDate;
  const amountBase = toBase(amount, line.currency, base, rates, paidAt);

  const payment = await prisma.$transaction(async (tx) => {
    const p = await tx.payment.create({
      data: {
        serviceId: line.serviceId,
        paidAt,
        amount,
        currency: line.currency,
        amountBase,
        source: "confirmed_expected",
        planLineId: line.id,
        comment: input.data.comment || null,
      },
    });
    await tx.planLine.update({ where: { id: line.id }, data: { status: "confirmed" } });
    return p;
  });
  await writeAudit({
    entity: "Payment",
    entityId: payment.id,
    actor: actor.tokenName,
    action: "confirm_expected",
    diff: { planLineId: line.id, source: "api" },
  });
  return { id: payment.id, amount_base: money(amountBase), base };
}

// ── reports / summaries ──────────────────────────────────────────────────────

export async function getMonthlyReport(
  _actor: ApiActor,
  params: { month: string; view?: string }
) {
  const m = params.month.match(/^(\d{4})-(\d{2})$/);
  if (!m) throw new ApiError(400, "month=YYYY-MM");
  const view: ReportView = params.view === "normalized" ? "normalized" : "cashflow";
  return buildReport(Number(m[1]), Number(m[2]) - 1, view);
}

export async function costsSummary(
  _actor: ApiActor,
  params: { group_by?: string; from?: string; to?: string }
) {
  const groupBy = ["category", "owner", "vendor", "billing_cycle"].includes(
    params.group_by ?? ""
  )
    ? (params.group_by as "category" | "owner" | "vendor" | "billing_cycle")
    : "category";

  const now = new Date();
  const from = params.from
    ? new Date(`${params.from}T00:00:00.000Z`)
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
  const to = params.to
    ? new Date(`${params.to}T23:59:59.999Z`)
    : now;

  const payments = await prisma.payment.findMany({
    where: { paidAt: { gte: from, lte: to } },
    include: {
      service: { include: { category: true, owner: true } },
    },
  });
  const { base } = await baseAndRates();
  const map = new Map<string, number>();
  for (const p of payments) {
    let key: string;
    if (groupBy === "category") key = p.service.category?.name ?? "Без категории";
    else if (groupBy === "owner")
      key = p.service.owner.name ?? p.service.owner.email ?? "—";
    else if (groupBy === "vendor") key = p.service.name;
    else key = p.service.billingCycle;
    map.set(key, (map.get(key) ?? 0) + p.amountBase.toNumber());
  }
  return {
    base,
    group_by: groupBy,
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    groups: [...map.entries()]
      .map(([name, total]) => ({ name, total: Math.round(total * 100) / 100 }))
      .sort((a, b) => b.total - a.total),
  };
}

export async function upcomingPayments(
  _actor: ApiActor,
  params: { days?: number }
) {
  const days = params.days && params.days > 0 ? params.days : 30;
  const now = new Date();
  const horizon = new Date(now.getTime() + days * 86400000);
  const { base, rates } = await baseAndRates();

  const services = await prisma.service.findMany({
    where: { status: "active" },
    include: { seats: { where: { endedAt: null } } },
  });

  const out: {
    service: string;
    date: string;
    amount: number;
    currency: string;
    amount_base: number;
  }[] = [];
  for (const s of services) {
    const next = computeNextPaymentDate(
      { billingCycle: s.billingCycle, billingDay: s.billingDay, renewalDate: s.renewalDate },
      now
    );
    if (!next || next > horizon) continue;
    const cycleCost = serviceMonthlyRunRate({
      billingModel: s.billingModel,
      billingCycle: "monthly", // сумма за списание = стоимость цикла
      price: s.price,
      seats: s.seats,
    });
    // Для yearly списание = годовая сумма; run-rate уже /12, поэтому берём цикловую.
    const amount =
      s.billingCycle === "yearly"
        ? cycleCost.mul(12)
        : cycleCost;
    out.push({
      service: s.name,
      date: next.toISOString().slice(0, 10),
      amount: money(amount),
      currency: s.currency,
      amount_base: money(toBase(amount, s.currency, base, rates, next)),
    });
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return { base, days, payments: out };
}

export async function needsAttention(_actor: ApiActor) {
  const now = new Date();
  const { charges } = await getExpectedCharges(now);
  const overdue = charges
    .filter((c) => c.overdue)
    .map((c) => ({
      service: c.serviceName,
      expected_date: c.expectedDate.slice(0, 10),
      amount_base: c.amountBase,
    }));

  const asOfDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const yearly = await prisma.service.findMany({
    where: { status: "active", billingCycle: "yearly", renewalDate: { not: null } },
  });
  const renewals = yearly
    .map((s) => {
      const r = s.renewalDate!;
      const windowStart = r.getTime() - s.cancellationNoticeDays * 86400000;
      return {
        service: s.name,
        renewal_date: r.toISOString().slice(0, 10),
        days_left: Math.ceil((r.getTime() - asOfDay) / 86400000),
        in_window: windowStart <= asOfDay && asOfDay <= r.getTime(),
      };
    })
    .filter((x) => x.in_window)
    .map(({ in_window: _in, ...rest }) => rest);

  return { overdue_confirmations: overdue, renewals_in_window: renewals };
}

export async function importCsv(actor: ApiActor, body: unknown) {
  requireApiRole(actor, "manager");
  const input = z
    .object({
      kind: z.enum(["services", "seats"]),
      csv: z.string().min(1),
    })
    .safeParse(body);
  if (!input.success) throw new ApiError(400, input.error.issues[0]!.message);

  const { parseCsv } = await import("@/lib/csv/parse");
  const { partitionUnique } = await import("@/lib/csv/dedup");
  const { records } = parseCsv(input.data.csv);
  if (records.length === 0) throw new ApiError(400, "Пустой CSV");

  const pick = (rec: Record<string, string>, ...keys: string[]) => {
    for (const k of keys) {
      const f = Object.keys(rec).find(
        (h) => h.trim().toLowerCase() === k.toLowerCase()
      );
      if (f && rec[f]) return rec[f]!;
    }
    return "";
  };

  let created = 0;
  const errors: string[] = [];

  if (input.data.kind === "services") {
    const existing = (
      await prisma.service.findMany({ select: { name: true } })
    ).map((s) => s.name);
    const { unique, duplicates } = partitionUnique(
      records,
      (r) => pick(r, "name"),
      existing
    );
    for (const rec of unique) {
      try {
        await createService(actor, {
          name: pick(rec, "name"),
          billing_model: pick(rec, "billing_model"),
          billing_cycle: pick(rec, "billing_cycle"),
          currency: pick(rec, "currency") || "USD",
          price: pick(rec, "price") || 0,
          seat_price_default: pick(rec, "seat_price") || undefined,
          billing_day: pick(rec, "billing_day") || undefined,
          renewal_date: pick(rec, "renewal_date") || undefined,
          owner_email: pick(rec, "owner_email"),
          category: pick(rec, "category") || undefined,
        });
        created++;
      } catch (e) {
        errors.push(
          `«${pick(rec, "name")}»: ${e instanceof ApiError ? e.message : "ошибка"}`
        );
      }
    }
    return { kind: "services", created, skipped_duplicates: duplicates.length, errors };
  }

  // seats
  const existingSeats = (
    await prisma.seat.findMany({
      where: { endedAt: null },
      select: { serviceId: true, employee: { select: { email: true } } },
    })
  ).map((s) => `${s.serviceId}|${s.employee.email.toLowerCase()}`);
  const services = await prisma.service.findMany({ select: { id: true, name: true } });
  const svcByName = new Map(services.map((s) => [s.name.toLowerCase(), s.id]));
  const withKey = records.map((r) => ({
    rec: r,
    serviceId: svcByName.get(pick(r, "service").toLowerCase()),
    email: pick(r, "email").toLowerCase(),
  }));
  const { unique, duplicates } = partitionUnique(
    withKey,
    (x) => `${x.serviceId ?? "?"}|${x.email}`,
    existingSeats
  );
  for (const { rec, serviceId, email } of unique) {
    if (!serviceId) {
      errors.push(`Сервис «${pick(rec, "service")}» не найден`);
      continue;
    }
    try {
      await addSeat(actor, {
        service_id: serviceId,
        email,
        full_name: pick(rec, "full_name") || undefined,
        seat_price: pick(rec, "seat_price") || undefined,
      });
      created++;
    } catch (e) {
      errors.push(`${email}: ${e instanceof ApiError ? e.message : "ошибка"}`);
    }
  }
  return { kind: "seats", created, skipped_duplicates: duplicates.length, errors };
}

export async function exportData(
  _actor: ApiActor,
  params: { kind?: string; format?: string }
) {
  const kind = params.kind ?? "services";
  const { exportServicesCsv, exportEmployeesCsv, exportPaymentsCsv } = await import(
    "@/lib/csv/table-export"
  );
  if (params.format === "json") {
    if (kind === "services") return listServices({ tokenName: "", role: "viewer" }, {});
    if (kind === "employees") return listEmployees({ tokenName: "", role: "viewer" });
  }
  if (kind === "services") return { format: "csv", data: await exportServicesCsv() };
  if (kind === "employees") return { format: "csv", data: await exportEmployeesCsv() };
  if (kind === "payments") return { format: "csv", data: await exportPaymentsCsv() };
  throw new ApiError(400, "kind: services | employees | payments");
}
