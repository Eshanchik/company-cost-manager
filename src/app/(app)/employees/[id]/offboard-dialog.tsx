"use client";

import * as React from "react";
import { useActionState } from "react";
import { UserMinus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatMoney } from "@/lib/format";
import { offboardEmployee } from "@/lib/actions/offboarding";
import type { ActionResult } from "@/lib/actions/types";

export type OffboardSeat = {
  id: string;
  serviceName: string;
  monthly: number;
  currency: string;
};

export function OffboardDialog({
  employeeId,
  employeeName,
  seats,
}: {
  employeeId: string;
  employeeName: string;
  seats: OffboardSeat[];
}) {
  const [open, setOpen] = React.useState(false);
  const [checked, setChecked] = React.useState<Set<string>>(
    () => new Set(seats.map((s) => s.id))
  );
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    offboardEmployee,
    null
  );

  React.useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success(state.message ?? "Готово");
      setOpen(false);
    } else toast.error(state.error);
  }, [state]);

  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Экономия по валютам для отмеченных мест.
  const savings = new Map<string, number>();
  for (const s of seats)
    if (checked.has(s.id))
      savings.set(s.currency, (savings.get(s.currency) ?? 0) + s.monthly);
  const savingsStr =
    [...savings.entries()].map(([c, a]) => formatMoney(a, c)).join(" + ") || "—";

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={seats.length === 0}
      >
        <UserMinus className="size-4" /> Офбординг
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form action={formAction} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Офбординг — {employeeName}</DialogTitle>
              <DialogDescription>
                Отметьте места для закрытия. Статус сотрудника станет
                «Офбординг».
              </DialogDescription>
            </DialogHeader>
            <input type="hidden" name="employeeId" value={employeeId} />

            <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2">
              {seats.map((s) => (
                <label
                  key={s.id}
                  className="flex cursor-pointer items-center justify-between gap-3 rounded px-2 py-1.5 hover:bg-accent"
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="seatId"
                      value={s.id}
                      checked={checked.has(s.id)}
                      onChange={() => toggle(s.id)}
                      className="size-4"
                    />
                    {s.serviceName}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {formatMoney(s.monthly, s.currency)}/мес
                  </span>
                </label>
              ))}
            </div>

            <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm">
              <span>Экономия/мес:</span>
              <span className="font-semibold">{savingsStr}</span>
            </div>

            <DialogFooter>
              <SubmitButton variant="destructive">
                Закрыть места и офбордить
              </SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
