import { prisma } from "@/lib/prisma";
import { serviceMonthlyRunRate } from "@/lib/calc/service-cost";
import {
  BILLING_MODEL_LABEL,
  BILLING_CYCLE_LABEL,
  STATUS_LABEL,
} from "@/lib/service-display";

const BOM = "﻿";
const SEP = ";";

function cell(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  const lines = [headers, ...rows].map((r) => r.map(cell).join(SEP));
  return BOM + lines.join("\r\n");
}

function d(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

export async function exportServicesCsv(): Promise<string> {
  const services = await prisma.service.findMany({
    include: {
      category: true,
      owner: true,
      paymentMethod: true,
      seats: { where: { endedAt: null } },
    },
    orderBy: { name: "asc" },
  });
  const rows = services.map((s) => [
    s.name,
    s.category?.name ?? "",
    BILLING_MODEL_LABEL[s.billingModel],
    BILLING_CYCLE_LABEL[s.billingCycle],
    s.price.toString(),
    s.seatPriceDefault?.toString() ?? "",
    s.currency,
    s.seats.length,
    serviceMonthlyRunRate({
      billingModel: s.billingModel,
      billingCycle: s.billingCycle,
      price: s.price,
      seats: s.seats,
    }).toFixed(2),
    s.owner.name ?? s.owner.email ?? "",
    s.paymentMethod?.name ?? "",
    d(s.nextPaymentDate),
    STATUS_LABEL[s.status],
  ]);
  return toCsv(
    [
      "Название",
      "Категория",
      "Модель",
      "Цикл",
      "Цена",
      "Цена места",
      "Валюта",
      "Мест",
      "Стоимость/мес",
      "Ответственный",
      "Способ оплаты",
      "След. оплата",
      "Статус",
    ],
    rows
  );
}

export async function exportEmployeesCsv(): Promise<string> {
  const employees = await prisma.employee.findMany({
    include: {
      seats: {
        where: { endedAt: null },
        include: { service: { select: { currency: true } } },
      },
    },
    orderBy: { fullName: "asc" },
  });
  const rows = employees.map((e) => [
    e.fullName,
    e.email,
    e.department ?? "",
    e.status === "offboarded" ? "Офбординг" : "Активен",
    e.seats.length,
  ]);
  return toCsv(
    ["Имя", "Email", "Отдел", "Статус", "Активных мест"],
    rows
  );
}

export async function exportPaymentsCsv(): Promise<string> {
  const payments = await prisma.payment.findMany({
    include: { service: { select: { name: true } } },
    orderBy: { paidAt: "desc" },
  });
  const sourceLabel: Record<string, string> = {
    manual: "Вручную",
    confirmed_expected: "Подтверждён",
    csv_import: "Импорт",
  };
  const rows = payments.map((p) => [
    d(p.paidAt),
    p.service.name,
    p.amount.toString(),
    p.currency,
    p.amountBase.toString(),
    sourceLabel[p.source] ?? p.source,
    p.comment ?? "",
  ]);
  return toCsv(
    ["Дата", "Сервис", "Сумма", "Валюта", "В базовой", "Источник", "Комментарий"],
    rows
  );
}
