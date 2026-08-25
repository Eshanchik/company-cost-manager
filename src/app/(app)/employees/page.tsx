import { Prisma } from "@prisma/client";
import { Download } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { normalizeToMonthly } from "@/lib/calc/service-cost";
import { convert, type RateRecord } from "@/lib/calc/fx";
import { formatMoney } from "@/lib/format";
import { EmployeesTable } from "./employees-table";
import { Button } from "@/components/ui/button";

export default async function EmployeesPage() {
  const [employees, settings, ratesRaw] = await Promise.all([
    prisma.employee.findMany({
      include: {
        seats: {
          where: { endedAt: null },
          include: {
            service: {
              select: {
                id: true,
                name: true,
                vendorUrl: true,
                billingCycle: true,
                currency: true,
              },
            },
          },
        },
      },
      orderBy: { fullName: "asc" },
    }),
    prisma.setting.upsert({
      where: { id: "singleton" },
      update: {},
      create: { id: "singleton" },
    }),
    prisma.fxRate.findMany(),
  ]);

  const baseCurrency = settings.baseCurrency;
  const rates: RateRecord[] = ratesRaw.map((r) => ({
    date: r.date,
    from: r.from,
    to: r.to,
    rate: r.rate,
  }));
  const now = new Date();

  // §4.7: итог — в базовой валюте; исходные суммы по валютам — в подсказке.
  const rows = employees.map((e) => {
    const byCurrency = new Map<string, Prisma.Decimal>();
    let totalBase = new Prisma.Decimal(0);
    for (const seat of e.seats) {
      const monthly = normalizeToMonthly(
        new Prisma.Decimal(seat.seatPrice),
        seat.service.billingCycle
      );
      const cur = seat.service.currency;
      byCurrency.set(
        cur,
        (byCurrency.get(cur) ?? new Prisma.Decimal(0)).add(monthly)
      );
      totalBase = totalBase.add(
        convert(monthly, cur, baseCurrency, now, rates) ?? monthly
      );
    }
    const costs = [...byCurrency.entries()].map(([currency, amount]) => ({
      currency,
      amount: amount.toNumber(),
    }));
    const mixed =
      costs.length > 1 || (costs[0] && costs[0].currency !== baseCurrency);
    return {
      id: e.id,
      fullName: e.fullName,
      email: e.email,
      department: e.department,
      status: e.status,
      seatsCount: e.seats.length,
      totalBase: totalBase.toNumber(),
      costsLabel: mixed
        ? costs.map((c) => formatMoney(c.amount, c.currency)).join(" + ")
        : null,
      services: e.seats.map((seat) => ({
        id: seat.service.id,
        name: seat.service.name,
        vendorUrl: seat.service.vendorUrl,
      })),
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Сотрудники</h1>
          <p className="text-sm text-muted-foreground">
            Люди, на которых оформлены места. Стоимость мест — нормализованная за
            месяц, в базовой валюте ({baseCurrency}); исходные суммы — в
            подсказке.
          </p>
        </div>
        <Button asChild variant="outline">
          <a href="/api/export?kind=employees" download>
            <Download className="size-4" /> Экспорт CSV
          </a>
        </Button>
      </div>

      <EmployeesTable rows={rows} baseCurrency={baseCurrency} />
    </div>
  );
}
