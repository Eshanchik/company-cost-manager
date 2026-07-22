import Link from "next/link";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { normalizeToMonthly } from "@/lib/calc/service-cost";
import { formatMoney } from "@/lib/format";
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
  const employees = await prisma.employee.findMany({
    include: {
      seats: {
        where: { endedAt: null },
        include: {
          service: { select: { billingCycle: true, currency: true } },
        },
      },
    },
    orderBy: { fullName: "asc" },
  });

  // Суммарная стоимость мест/мес считается в валюте сервиса; при разных
  // валютах у сотрудника показываем разбивку по валютам (конвертация — Блок 6).
  const rows = employees.map((e) => {
    const byCurrency = new Map<string, Prisma.Decimal>();
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
    }
    return {
      id: e.id,
      fullName: e.fullName,
      email: e.email,
      department: e.department,
      status: e.status,
      seatsCount: e.seats.length,
      costs: [...byCurrency.entries()].map(([currency, amount]) => ({
        currency,
        amount: amount.toNumber(),
      })),
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Сотрудники</h1>
        <p className="text-sm text-muted-foreground">
          Люди, на которых оформлены места. Стоимость мест — нормализованная за
          месяц.
        </p>
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
                  <TableCell className="text-right tabular-nums">
                    {r.costs.length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      r.costs
                        .map((c) => formatMoney(c.amount, c.currency))
                        .join(" + ")
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
