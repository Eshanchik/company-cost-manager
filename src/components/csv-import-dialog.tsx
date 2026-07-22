"use client";

import * as React from "react";
import { useActionState } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SubmitButton } from "@/components/ui/submit-button";
import { parseCsv } from "@/lib/csv/parse";
import {
  importServicesCsv,
  importSeatsCsv,
  importPaymentsCsv,
  type ImportResult,
} from "@/lib/actions/import";

type ImportKind = "services" | "seats" | "payments";

const HINTS: Record<ImportKind, string> = {
  services:
    "Заголовки: name, billing_model (fixed|per_seat|hybrid), billing_cycle (monthly|yearly), currency, price, seat_price, billing_day, renewal_date, owner_email, category",
  seats: "Заголовки: service, email, seat_price, full_name",
  payments:
    "Заголовки: service, paid_at (YYYY-MM-DD), amount, currency, comment, invoice_url",
};

const KIND_LABEL: Record<ImportKind, string> = {
  services: "сервисов",
  seats: "мест",
  payments: "платежей",
};

const ACTIONS = {
  services: importServicesCsv,
  seats: importSeatsCsv,
  payments: importPaymentsCsv,
};

export function CsvImportDialog({ kind }: { kind: ImportKind }) {
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState("");
  const action = ACTIONS[kind];
  const [state, formAction] = useActionState<ImportResult | null, FormData>(
    action,
    null
  );

  const preview = React.useMemo(() => {
    if (!text.trim()) return null;
    try {
      return parseCsv(text);
    } catch {
      return null;
    }
  }, [text]);

  React.useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success(
        `Импортировано: ${state.created}, пропущено дублей: ${state.skippedDuplicates}` +
          (state.errors.length ? `, ошибок: ${state.errors.length}` : "")
      );
      if (state.errors.length === 0) setOpen(false);
    } else {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Upload className="size-4" /> Импорт CSV
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <form action={formAction} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Импорт {KIND_LABEL[kind]} из CSV</DialogTitle>
              <DialogDescription>{HINTS[kind]}</DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="csv-text">Вставьте CSV</Label>
              <textarea
                id="csv-text"
                name="csv"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={8}
                className="w-full rounded-md border border-input bg-transparent p-3 font-mono text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder={
                  kind === "services"
                    ? "name,billing_model,billing_cycle,currency,seat_price,billing_day,owner_email\nMiro,per_seat,monthly,USD,8,5,ivan.petrov@example.com"
                    : kind === "seats"
                      ? "service,email,seat_price\nFigma,new.person@company.com,15"
                      : "service,paid_at,amount,currency\nFigma,2026-07-05,65,USD"
                }
              />
            </div>

            {preview && preview.records.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  Предпросмотр: {preview.records.length} строк, разделитель «
                  {preview.delimiter}», колонки: {preview.headers.join(", ")}
                </p>
                <div className="max-h-40 overflow-auto rounded-md border text-xs">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        {preview.headers.map((h) => (
                          <th key={h} className="px-2 py-1 text-left">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.records.slice(0, 5).map((r, i) => (
                        <tr key={i} className="border-t">
                          {preview.headers.map((h) => (
                            <td key={h} className="px-2 py-1">
                              {r[h]}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {state && state.ok && state.errors.length > 0 && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs">
                <p className="font-medium">Ошибки ({state.errors.length}):</p>
                <ul className="list-inside list-disc">
                  {state.errors.slice(0, 10).map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            )}

            <DialogFooter>
              <SubmitButton disabled={!preview || preview.records.length === 0}>
                Импортировать
              </SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
