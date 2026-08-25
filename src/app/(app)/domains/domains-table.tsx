"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Search, X, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney, formatDate } from "@/lib/format";
import { STATUS_LABEL, STATUS_VARIANT } from "@/lib/service-display";
import {
  ServiceDialog,
  type ServiceDefaults,
  type ServiceOptions,
} from "@/components/service-dialog";
import type { ServiceStatus } from "@prisma/client";

const PAGE_SIZE = 50;

export type DomainRow = {
  id: string;
  name: string;
  registrar: string | null;
  autoRenew: boolean;
  price: number;
  currency: string;
  runRateBase: number;
  renewalDate: string | null;
  prepaidUntil: string | null;
  daysLeft: number | null;
  status: ServiceStatus;
  defaults: ServiceDefaults;
};

export function DomainsTable({
  rows,
  options,
  canEdit,
  baseCurrency,
}: {
  rows: DomainRow[];
  options: ServiceOptions;
  canEdit: boolean;
  baseCurrency: string;
}) {
  const [q, setQ] = React.useState("");
  const [registrar, setRegistrar] = React.useState("");
  const [expiring, setExpiring] = React.useState("");
  const [priceFilter, setPriceFilter] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ServiceDefaults | null>(null);

  const registrars = React.useMemo(
    () =>
      [...new Set(rows.map((r) => r.registrar).filter(Boolean))].sort() as string[],
    [rows]
  );

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (needle && !r.name.toLowerCase().includes(needle)) return false;
      if (registrar && r.registrar !== registrar) return false;
      if (expiring === "30" && !(r.daysLeft !== null && r.daysLeft <= 30))
        return false;
      if (expiring === "90" && !(r.daysLeft !== null && r.daysLeft <= 90))
        return false;
      if (expiring === "expired" && !(r.daysLeft !== null && r.daysLeft < 0))
        return false;
      if (priceFilter === "missing" && r.price > 0) return false;
      if (priceFilter === "known" && r.price <= 0) return false;
      return true;
    });
  }, [rows, q, registrar, expiring, priceFilter]);

  React.useEffect(() => setPage(1), [q, registrar, expiring, priceFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalMonthly = filtered.reduce((a, r) => a + r.runRateBase, 0);
  const missingPrice = filtered.filter((r) => r.price <= 0).length;
  const totalYearly = totalMonthly * 12;

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск по домену…"
            className="pl-8"
          />
        </div>
        <NativeSelect
          className="h-9 w-auto"
          value={registrar}
          onChange={(e) => setRegistrar(e.target.value)}
        >
          <option value="">Регистратор: все</option>
          {registrars.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          className="h-9 w-auto"
          value={expiring}
          onChange={(e) => setExpiring(e.target.value)}
        >
          <option value="">Срок: любой</option>
          <option value="30">Истекает ≤ 30 дней</option>
          <option value="90">Истекает ≤ 90 дней</option>
          <option value="expired">Просрочен</option>
        </NativeSelect>
        <NativeSelect
          className="h-9 w-auto"
          value={priceFilter}
          onChange={(e) => setPriceFilter(e.target.value)}
        >
          <option value="">Цена: любая</option>
          <option value="missing">Не указана</option>
          <option value="known">Указана</option>
        </NativeSelect>
        {(q || registrar || expiring || priceFilter) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQ("");
              setRegistrar("");
              setExpiring("");
              setPriceFilter("");
            }}
          >
            <X className="size-4" /> Сбросить
          </Button>
        )}
        {canEdit && (
          <Button onClick={openCreate}>
            <Plus className="size-4" /> Добавить домен
          </Button>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Домен</TableHead>
              <TableHead>Регистратор</TableHead>
              <TableHead className="text-right">Цена/год</TableHead>
              <TableHead className="text-right">В мес. ({baseCurrency})</TableHead>
              <TableHead>Продление</TableHead>
              <TableHead>Авто</TableHead>
              <TableHead>Статус</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-24 text-center text-muted-foreground"
                >
                  {rows.length === 0
                    ? "Доменов пока нет. Добавьте вручную или импортируйте CSV."
                    : "Ничего не найдено."}
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link
                      href={`/services/${r.id}`}
                      className="font-medium hover:underline"
                    >
                      {r.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.registrar ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.price > 0 ? (
                      formatMoney(r.price, r.currency)
                    ) : (
                      <Badge
                        variant="secondary"
                        title="В реестре цена не указана — стоимость не учитывается в расходах"
                      >
                        не указана
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(r.runRateBase, baseCurrency)}
                  </TableCell>
                  <TableCell className="text-sm">
                    <span className="flex items-center gap-1">
                      {formatDate(r.renewalDate)}
                      {r.daysLeft !== null && r.daysLeft < 0 && (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="size-3" /> просрочен
                        </Badge>
                      )}
                      {r.daysLeft !== null &&
                        r.daysLeft >= 0 &&
                        r.daysLeft <= 30 && (
                          <Badge variant="secondary">
                            через {r.daysLeft} дн.
                          </Badge>
                        )}
                    </span>
                    {r.prepaidUntil && (
                      <div className="text-xs text-muted-foreground">
                        оплачено до {formatDate(r.prepaidUntil)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {r.autoRenew ? (
                      <Badge variant="outline">вкл</Badge>
                    ) : (
                      <Badge variant="secondary">выкл</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[r.status]}>
                      {STATUS_LABEL[r.status]}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Показано {pageRows.length} из {filtered.length} (всего {rows.length}).
          Итого по фильтру:{" "}
          <strong>{formatMoney(totalMonthly, baseCurrency)}</strong>/мес ≈{" "}
          <strong>{formatMoney(totalYearly, baseCurrency)}</strong>/год
          {missingPrice > 0 && (
            <>
              {" · "}
              <span className="text-amber-600">
                у {missingPrice} доменов цена не указана — расходы занижены
              </span>
            </>
          )}
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-2 text-sm">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Назад
            </Button>
            <span className="text-muted-foreground">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Вперёд
            </Button>
          </div>
        )}
      </div>

      {canEdit && (
        <ServiceDialog
          key={editing?.id ?? "new-domain"}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          service={editing}
          options={options}
          kind="domain"
        />
      )}
    </div>
  );
}
