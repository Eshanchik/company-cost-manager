"use client";

import * as React from "react";
import { useActionState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { upsertFxRate, triggerFxUpdate } from "@/lib/actions/fx";
import { SUPPORTED_CURRENCIES } from "@/lib/currencies";
import { formatDate } from "@/lib/format";
import type { ActionResult } from "@/lib/actions/types";

export type FxRateRow = {
  from: string;
  to: string;
  rate: string;
  date: string;
};

export function FxRatesManager({
  baseCurrency,
  rates,
  today,
}: {
  baseCurrency: string;
  rates: FxRateRow[];
  today: string;
}) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    upsertFxRate,
    null
  );
  const [pending, startTransition] = useTransition();

  React.useEffect(() => {
    if (!state) return;
    if (state.ok) toast.success(state.message ?? "Готово");
    else toast.error(state.error);
  }, [state]);

  const refresh = () => {
    startTransition(async () => {
      const res = await triggerFxUpdate(null, new FormData());
      if (res.ok) toast.success(res.message ?? "Обновлено");
      else toast.error(res.error);
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Курсы к базовой валюте <strong>{baseCurrency}</strong>. Автообновление
          с frankfurter.app ежедневно в 07:00; ручной ввод — как fallback.
        </p>
        <Button variant="outline" size="sm" disabled={pending} onClick={refresh}>
          <RefreshCw className={`size-4 ${pending ? "animate-spin" : ""}`} />
          Обновить сейчас
        </Button>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium">
          Актуальные курсы (последний известный)
        </h3>
        {rates.length === 0 ? (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Курсов пока нет. Обновите с frankfurter.app или введите вручную.
          </p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Пара</TableHead>
                  <TableHead className="text-right">Курс</TableHead>
                  <TableHead>Дата</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rates.map((r) => (
                  <TableRow key={`${r.from}-${r.to}`}>
                    <TableCell className="font-medium">
                      {r.from} → {r.to}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.rate}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(r.date)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium">Ручной ввод / правка курса</h3>
        <form
          action={formAction}
          className="flex flex-wrap items-end gap-3 rounded-md border p-4"
        >
          <div className="w-28 space-y-2">
            <Label htmlFor="fx-from">Из</Label>
            <NativeSelect id="fx-from" name="from" defaultValue="EUR">
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="w-28 space-y-2">
            <Label htmlFor="fx-to">В</Label>
            <NativeSelect id="fx-to" name="to" defaultValue={baseCurrency}>
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="w-40 space-y-2">
            <Label htmlFor="fx-rate">Курс</Label>
            <Input
              id="fx-rate"
              name="rate"
              type="number"
              step="0.00000001"
              min="0"
              required
            />
          </div>
          <div className="w-44 space-y-2">
            <Label htmlFor="fx-date">Дата</Label>
            <Input id="fx-date" name="date" type="date" defaultValue={today} required />
          </div>
          <SubmitButton>Сохранить курс</SubmitButton>
        </form>
      </div>
    </div>
  );
}
