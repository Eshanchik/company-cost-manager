import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/authz";
import { normalizeToMonthly } from "@/lib/calc/service-cost";
import { formatMoney, formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ServiceFavicon } from "@/components/service-favicon";
import { EditEmployee } from "./edit-employee";

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  const canEdit = user ? hasRole(user.role, "manager") : false;

  const employee = await prisma.employee.findUnique({
    where: { id },
    include: {
      seats: {
        include: { service: true },
        orderBy: { startedAt: "desc" },
      },
    },
  });
  if (!employee) notFound();

  const activeSeats = employee.seats.filter((s) => !s.endedAt);
  const closedSeats = employee.seats.filter((s) => s.endedAt);

  const costByCurrency = new Map<string, Prisma.Decimal>();
  for (const seat of activeSeats) {
    const monthly = normalizeToMonthly(
      new Prisma.Decimal(seat.seatPrice),
      seat.service.billingCycle
    );
    const cur = seat.service.currency;
    costByCurrency.set(
      cur,
      (costByCurrency.get(cur) ?? new Prisma.Decimal(0)).add(monthly)
    );
  }
  const totals = [...costByCurrency.entries()];

  return (
    <div className="space-y-6">
      <Link
        href="/employees"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> К списку сотрудников
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {employee.fullName}
            </h1>
            {employee.status === "offboarded" && (
              <Badge variant="outline">Офбординг</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {employee.email}
            {employee.department ? ` · ${employee.department}` : ""}
          </p>
        </div>
        {canEdit && (
          <EditEmployee
            employee={{
              id: employee.id,
              fullName: employee.fullName,
              department: employee.department,
            }}
          />
        )}
      </div>

      <Card>
        <CardContent className="flex flex-wrap gap-x-10 gap-y-2 pt-6">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Активных мест
            </div>
            <div className="mt-1 text-lg font-semibold">
              {activeSeats.length}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Стоимость/мес
            </div>
            <div className="mt-1 text-lg font-semibold">
              {totals.length === 0
                ? "—"
                : totals
                    .map(([cur, amt]) => formatMoney(amt.toNumber(), cur))
                    .join(" + ")}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h2 className="text-sm font-medium">Места</h2>
        {employee.seats.length === 0 ? (
          <p className="text-sm text-muted-foreground">Мест нет.</p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Сервис</TableHead>
                  <TableHead className="text-right">Цена/цикл</TableHead>
                  <TableHead className="text-right">Стоимость/мес</TableHead>
                  <TableHead>Начало</TableHead>
                  <TableHead>Статус</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employee.seats.map((s) => {
                  const monthly = normalizeToMonthly(
                    new Prisma.Decimal(s.seatPrice),
                    s.service.billingCycle
                  );
                  return (
                    <TableRow key={s.id} className={s.endedAt ? "opacity-60" : ""}>
                      <TableCell>
                        <Link
                          href={`/services/${s.serviceId}`}
                          className="flex items-center gap-2 font-medium hover:underline"
                        >
                          <ServiceFavicon
                            vendorUrl={s.service.vendorUrl}
                            name={s.service.name}
                          />
                          {s.service.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(s.seatPrice, s.service.currency)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(monthly.toNumber(), s.service.currency)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(s.startedAt)}
                      </TableCell>
                      <TableCell>
                        {s.endedAt ? (
                          <Badge variant="outline">
                            Закрыто {formatDate(s.endedAt)}
                          </Badge>
                        ) : (
                          <Badge variant="default">Активно</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
        {closedSeats.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Закрытых мест: {closedSeats.length}.
          </p>
        )}
      </div>
    </div>
  );
}
