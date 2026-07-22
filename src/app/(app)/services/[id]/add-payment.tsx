"use client";

import * as React from "react";
import { useActionState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { recordManualPayment } from "@/lib/actions/payments";
import { SUPPORTED_CURRENCIES } from "@/lib/currencies";
import type { ActionResult } from "@/lib/actions/types";

export function AddPaymentButton({
  serviceId,
  currency,
  today,
}: {
  serviceId: string;
  currency: string;
  today: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    recordManualPayment,
    null
  );

  React.useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success(state.message ?? "Готово");
      setOpen(false);
    } else toast.error(state.error);
  }, [state]);

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Добавить платёж
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form action={formAction} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Ручной платёж</DialogTitle>
              <DialogDescription>
                Разовое списание вне плана. amount_base фиксируется по курсу даты.
              </DialogDescription>
            </DialogHeader>
            <input type="hidden" name="serviceId" value={serviceId} />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mp-amount">Сумма</Label>
                <Input
                  id="mp-amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mp-currency">Валюта</Label>
                <NativeSelect
                  id="mp-currency"
                  name="currency"
                  defaultValue={currency}
                >
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mp-date">Дата платежа</Label>
              <Input
                id="mp-date"
                name="paidAt"
                type="date"
                defaultValue={today}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mp-comment">Комментарий</Label>
              <Input id="mp-comment" name="comment" placeholder="Необязательно" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mp-invoice">Ссылка на инвойс</Label>
              <Input
                id="mp-invoice"
                name="invoiceUrl"
                type="url"
                placeholder="Необязательно"
              />
            </div>
            <DialogFooter>
              <SubmitButton>Добавить платёж</SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
