import Link from "next/link";
import { Prisma } from "@prisma/client";
import { Download } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { normalizeToMonthly } from "@/lib/calc/service-cost";
import { convert, type RateRecord } from "@/lib/calc/fx";
import { formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function EmployeesPage() {
  const [employees, settings, ratesRaw] = await Promise.all([
    prisma.employee.findMany({
      include: {
        seats: {
          where: { endedAt: null },
          include: {
            service: { select: { billingCycle: true, currency: true } },
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
    return {
      id: e.id,
      fullName: e.fullName,
      email: e.email,
      department: e.department,
      status: e.status,
      seatsCount: e.seats.length,
      totalBase: totalBase.toNumber(),
      costs: [...byCurrency.entries()].map(([currency, amount]) => ({
        currency,
        amount: amount.toNumber(),
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

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Сотрудник</TableHead>
              <TableHead>Отдел</TableHead>
              <TableHead className="text-right">Активных мест</TableHead>
              <TableHead className="text-right">Стоимость/мес</TableHead>
              <TableHead>Статус</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-24 text-center text-muted-foreground"
                >
                  Сотрудников пока нет.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link
                      href={`/employees/${r.id}`}
                      className="font-medium hover:underline"
                    >
                      {r.fullName}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {r.email}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {r.department ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.seatsCount}
                  </TableCell>
                  <TableCell
                    className="text-right tabular-nums"
                    title={
                      r.costs.length > 1 ||
                      (r.costs[0] && r.costs[0].currency !== baseCurrency)
                        ? r.costs
                            .map((c) => formatMoney(c.amount, c.currency))
                            .join(" + ")
                        : undefined
                    }
                  >
                    {r.costs.length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      formatMoney(r.totalBase, baseCurrency)
                    )}
                  </TableCell>
                  <TableCell>
                    {r.status === "offboarded" ? (
                      <Badge variant="outline">Офбординг</Badge>
                    ) : (
                      <Badge variant="default">Активен</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
