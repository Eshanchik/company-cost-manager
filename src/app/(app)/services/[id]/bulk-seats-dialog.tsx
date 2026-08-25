"use client";

import * as React from "react";
import { useActionState } from "react";
import { UsersRound } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { bulkAddSeats, type BulkSeatsResult } from "@/lib/actions/seats";
import { parseEmailList } from "@/lib/seats/emails";

export function BulkSeatsDialog({
  serviceId,
  seatPriceDefault,
}: {
  serviceId: string;
  seatPriceDefault: string | null;
}) {
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState("");
  const [state, formAction] = useActionState<BulkSeatsResult | null, FormData>(
    bulkAddSeats,
    null
  );

  const preview = React.useMemo(() => parseEmailList(text), [text]);

  React.useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success(state.message);
      // Закрываем только если всё прошло чисто — иначе показываем, кого пропустили.
      if (state.skipped.length === 0) {
        setOpen(false);
        setText("");
      }
    } else {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <UsersRound className="size-4" /> Добавить несколько
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <form action={formAction} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Добавить несколько мест</DialogTitle>
              <DialogDescription>
                Вставьте список email — по одному в строке или через запятую.
                Новые сотрудники создадутся автоматически.
              </DialogDescription>
            </DialogHeader>

            <input type="hidden" name="serviceId" value={serviceId} />

            <div className="space-y-2">
              <Label htmlFor="bulk-emails">Email сотрудников</Label>
              <textarea
                id="bulk-emails"
                name="emails"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={8}
                className="w-full rounded-md border border-input bg-transparent p-3 font-mono text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder={"anna@company.com\nboris@company.com\nvera@company.com"}
              />
              {(preview.emails.length > 0 || preview.invalid.length > 0) && (
                <p className="text-xs text-muted-foreground">
                  Распознано адресов: <strong>{preview.emails.length}</strong>
                  {preview.invalid.length > 0 && (
                    <>
                      {" "}· некорректных:{" "}
                      <span className="text-destructive">
                        {preview.invalid.length}
                      </span>{" "}
                      ({preview.invalid.slice(0, 3).join(", ")}
                      {preview.invalid.length > 3 ? "…" : ""})
                    </>
                  )}
                </p>
              )}
            </div>

            <div className="w-48 space-y-2">
              <Label htmlFor="bulk-price">Цена места</Label>
              <Input
                id="bulk-price"
                name="seatPrice"
                type="number"
                step="0.01"
                min="0"
                placeholder={seatPriceDefault ?? "0"}
              />
              <p className="text-xs text-muted-foreground">
                Пусто — цена по умолчанию для сервиса.
              </p>
            </div>

            {state?.ok && state.skipped.length > 0 && (
              <div className="space-y-1 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs">
                <p className="font-medium">
                  Добавлено: {state.added}. Пропущено: {state.skipped.length}
                </p>
                <ul className="space-y-0.5">
                  {state.skipped.slice(0, 12).map((s) => (
                    <li key={s.email} className="flex justify-between gap-2">
                      <span className="font-mono">{s.email}</span>
                      <Badge variant="secondary">{s.reason}</Badge>
                    </li>
                  ))}
                </ul>
                {state.skipped.length > 12 && (
                  <p className="text-muted-foreground">
                    …и ещё {state.skipped.length - 12}
                  </p>
                )}
              </div>
            )}

            <DialogFooter>
              <SubmitButton disabled={preview.emails.length === 0}>
                Добавить {preview.emails.length > 0 && `(${preview.emails.length})`}
              </SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
