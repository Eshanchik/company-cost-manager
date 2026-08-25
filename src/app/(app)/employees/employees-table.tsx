"use client";

import * as React from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
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
import { ServiceFavicon } from "@/components/service-favicon";
import { formatMoney } from "@/lib/format";

export type EmployeeRow = {
  id: string;
  fullName: string;
  email: string;
  department: string | null;
  status: string;
  seatsCount: number;
  totalBase: number;
  costsLabel: string | null;
  services: { id: string; name: string; vendorUrl: string | null }[];
};

export function EmployeesTable({
  rows,
  baseCurrency,
}: {
  rows: EmployeeRow[];
  baseCurrency: string;
}) {
  const [q, setQ] = React.useState("");

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (r) =>
        r.email.toLowerCase().includes(needle) ||
        r.fullName.toLowerCase().includes(needle) ||
        (r.department ?? "").toLowerCase().includes(needle) ||
        r.services.some((s) => s.name.toLowerCase().includes(needle))
    );
  }, [rows, q]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск по email, имени, отделу или сервису…"
            className="pl-8"
            autoFocus
          />
        </div>
        {q && (
          <Button variant="ghost" size="sm" onClick={() => setQ("")}>
            <X className="size-4" /> Сбросить
          </Button>
        )}
        <span className="text-xs text-muted-foreground">
          {filtered.length} из {rows.length}
        </span>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Сотрудник</TableHead>
              <TableHead>Отдел</TableHead>
              <TableHead>Сервисы</TableHead>
              <TableHead className="text-right">Стоимость/мес</TableHead>
              <TableHead>Статус</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-24 text-center text-muted-foreground"
                >
                  {rows.length === 0
                    ? "Сотрудников пока нет."
                    : `По запросу «${q}» никого не найдено.`}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
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
                  <TableCell>
                    {r.services.length === 0 ? (
                      <span className="text-sm text-muted-foreground">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {r.services.map((s) => (
                          <Link key={s.id} href={`/services/${s.id}`}>
                            <Badge
                              variant="secondary"
                              className="gap-1 hover:bg-accent"
                            >
                              <ServiceFavicon
                                vendorUrl={s.vendorUrl}
                                name={s.name}
                                size={14}
                              />
                              {s.name}
                            </Badge>
                          </Link>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell
                    className="text-right tabular-nums"
                    title={r.costsLabel ?? undefined}
                  >
                    {r.seatsCount === 0 ? (
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
