"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpDown, Plus, Save, Filter } from "lucide-react";

import type {
  BillingModel,
  BillingCycle,
  ServiceStatus,
} from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/native-select";
import { ServiceFavicon } from "@/components/service-favicon";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney, formatDate } from "@/lib/format";
import {
  STATUS_LABEL,
  STATUS_VARIANT,
  BILLING_MODEL_LABEL,
  BILLING_CYCLE_LABEL,
} from "@/lib/service-display";
import {
  ServiceDialog,
  type ServiceOptions,
  type ServiceDefaults,
} from "@/components/service-dialog";

export type ServiceRow = {
  id: string;
  name: string;
  vendorUrl: string | null;
  categoryId: string | null;
  categoryName: string | null;
  billingModel: BillingModel;
  billingCycle: BillingCycle;
  runRateMonthly: number;
  currency: string;
  seatsCount: number;
  ownerId: string;
  ownerLabel: string;
  paymentMethodId: string | null;
  paymentMethodName: string | null;
  nextPaymentDate: string | null;
  status: ServiceStatus;
};

type Filters = {
  q: string;
  status: string;
  cycle: string;
  category: string;
  owner: string;
  method: string;
};

const EMPTY: Filters = {
  q: "",
  status: "",
  cycle: "",
  category: "",
  owner: "",
  method: "",
};

type SortKey = "name" | "runRateMonthly" | "seatsCount" | "nextPaymentDate";

const PRESET_KEY = "subtrack.servicePresets";

export function ServicesTable({
  rows,
  options,
  canEdit,
}: {
  rows: ServiceRow[];
  options: ServiceOptions;
  canEdit: boolean;
}) {
  const [filters, setFilters] = React.useState<Filters>(EMPTY);
  const [sort, setSort] = React.useState<{ key: SortKey; dir: 1 | -1 }>({
    key: "name",
    dir: 1,
  });
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ServiceDefaults | null>(null);
  const [presets, setPresets] = React.useState<Record<string, Filters>>({});

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(PRESET_KEY);
      if (raw) setPresets(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  const savePreset = () => {
    const name = prompt("Название пресета фильтров:");
    if (!name) return;
    const next = { ...presets, [name]: filters };
    setPresets(next);
    localStorage.setItem(PRESET_KEY, JSON.stringify(next));
  };
  const deletePreset = (name: string) => {
    const next = { ...presets };
    delete next[name];
    setPresets(next);
    localStorage.setItem(PRESET_KEY, JSON.stringify(next));
  };

  const set = (patch: Partial<Filters>) =>
    setFilters((f) => ({ ...f, ...patch }));

  const filtered = React.useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    const out = rows.filter((r) => {
      if (q && !r.name.toLowerCase().includes(q)) return false;
      if (filters.status && r.status !== filters.status) return false;
      if (filters.cycle && r.billingCycle !== filters.cycle) return false;
      if (filters.category && r.categoryId !== filters.category) return false;
      if (filters.owner && r.ownerId !== filters.owner) return false;
      if (filters.method && r.paymentMethodId !== filters.method) return false;
      return true;
    });
    out.sort((a, b) => {
      const { key, dir } = sort;
      let cmp = 0;
      if (key === "name") cmp = a.name.localeCompare(b.name, "ru");
      else if (key === "runRateMonthly")
        cmp = a.runRateMonthly - b.runRateMonthly;
      else if (key === "seatsCount") cmp = a.seatsCount - b.seatsCount;
      else if (key === "nextPaymentDate")
        cmp = (a.nextPaymentDate ?? "").localeCompare(b.nextPaymentDate ?? "");
      return cmp * dir;
    });
    return out;
  }, [rows, filters, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((s) =>
      s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: 1 }
    );

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Input
            placeholder="Поиск по названию…"
            value={filters.q}
            onChange={(e) => set({ q: e.target.value })}
          />
        </div>
        {canEdit && (
          <Button onClick={openCreate}>
            <Plus className="size-4" /> Добавить сервис
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Filter className="size-4 text-muted-foreground" />
        <FilterSelect
          value={filters.status}
          onChange={(v) => set({ status: v })}
          placeholder="Статус"
          options={(["active", "paused", "cancelled", "archived"] as const).map(
            (s) => ({ value: s, label: STATUS_LABEL[s] })
          )}
        />
        <FilterSelect
          value={filters.cycle}
          onChange={(v) => set({ cycle: v })}
          placeholder="Цикл"
          options={(["monthly", "yearly"] as const).map((c) => ({
            value: c,
            label: BILLING_CYCLE_LABEL[c],
          }))}
        />
        <FilterSelect
          value={filters.category}
          onChange={(v) => set({ category: v })}
          placeholder="Категория"
          options={options.categories.map((c) => ({
            value: c.id,
            label: c.name,
          }))}
        />
        <FilterSelect
          value={filters.owner}
          onChange={(v) => set({ owner: v })}
          placeholder="Ответственный"
          options={options.owners.map((o) => ({ value: o.id, label: o.label }))}
        />
        <FilterSelect
          value={filters.method}
          onChange={(v) => set({ method: v })}
          placeholder="Способ оплаты"
          options={options.methods.map((m) => ({ value: m.id, label: m.name }))}
        />
        <Button variant="outline" size="sm" onClick={() => setFilters(EMPTY)}>
          Сбросить
        </Button>
        <Button variant="outline" size="sm" onClick={savePreset}>
          <Save className="size-4" /> Сохранить пресет
        </Button>
        {Object.keys(presets).length > 0 && (
          <NativeSelect
            className="h-8 w-auto"
            value=""
            onChange={(e) => {
              const p = presets[e.target.value];
              if (p) setFilters(p);
            }}
          >
            <option value="">Пресеты…</option>
            {Object.keys(presets).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </NativeSelect>
        )}
      </div>

      {Object.keys(presets).length > 0 && (
        <div className="flex flex-wrap gap-1">
          {Object.keys(presets).map((n) => (
            <Badge key={n} variant="secondary" className="gap-1">
              {n}
              <button
                className="ml-1 text-muted-foreground hover:text-foreground"
                onClick={() => deletePreset(n)}
                aria-label={`Удалить пресет ${n}`}
              >
                ×
              </button>
            </Badge>
          ))}
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <SortButton label="Сервис" onClick={() => toggleSort("name")} />
              </TableHead>
              <TableHead>Категория</TableHead>
              <TableHead>Модель</TableHead>
              <TableHead className="text-right">
                <SortButton
                  label="Стоимость/мес"
                  onClick={() => toggleSort("runRateMonthly")}
                />
              </TableHead>
              <TableHead className="text-right">
                <SortButton
                  label="Мест"
                  onClick={() => toggleSort("seatsCount")}
                />
              </TableHead>
              <TableHead>Ответственный</TableHead>
              <TableHead>
                <SortButton
                  label="След. оплата"
                  onClick={() => toggleSort("nextPaymentDate")}
                />
              </TableHead>
              <TableHead>Статус</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  Ничего не найдено.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link
                      href={`/services/${r.id}`}
                      className="flex items-center gap-2 font-medium hover:underline"
                    >
                      <ServiceFavicon vendorUrl={r.vendorUrl} name={r.name} />
                      {r.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {r.categoryName ? (
                      <span className="text-sm">{r.categoryName}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {BILLING_MODEL_LABEL[r.billingModel]}
                    <span className="text-muted-foreground">
                      {" · "}
                      {BILLING_CYCLE_LABEL[r.billingCycle]}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(r.runRateMonthly, r.currency)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.billingModel === "fixed" ? "—" : r.seatsCount}
                  </TableCell>
                  <TableCell className="text-sm">{r.ownerLabel}</TableCell>
                  <TableCell className="text-sm">
                    {formatDate(r.nextPaymentDate)}
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

      <p className="text-xs text-muted-foreground">
        Показано {filtered.length} из {rows.length}. Стоимость/мес —
        нормализованная (yearly ÷ 12), в валюте сервиса.
      </p>

      {canEdit && (
        <ServiceDialog
          key={editing?.id ?? "new"}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          service={editing}
          options={options}
        />
      )}
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
}) {
  return (
    <NativeSelect
      className="h-8 w-auto"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{placeholder}: все</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </NativeSelect>
  );
}

function SortButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 font-medium hover:text-foreground"
    >
      {label}
      <ArrowUpDown className="size-3" />
    </button>
  );
}
