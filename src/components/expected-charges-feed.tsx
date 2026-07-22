"use client";

import * as React from "react";
import { useActionState } from "react";
import { Check, Ban } from "lucide-react";
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
import { ServiceFavicon } from "@/components/service-favicon";
import { formatMoney, formatDate } from "@/lib/format";
import {
  confirmExpectedPayment,
  waivePlanLine,
} from "@/lib/actions/payments";
import type { ExpectedCharge } from "@/lib/plan/expected-charges";
import type { ActionResult } from "@/lib/actions/types";

export function ExpectedChargesFeed({
  charges,
  baseCurrency,
  canEdit,
}: {
  charges: ExpectedCharge[];
  baseCurrency: string;
  canEdit: boolean;
}) {
  const [confirming, setConfirming] = React.useState<ExpectedCharge | null>(null);
  const [waiving, setWaiving] = React.useState<ExpectedCharge | null>(null);

  if (charges.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        Нет ожидаемых списаний. Всё подтверждено 🎉
      </p>
    );
  }

  return (
    <div className="divide-y rounded-md border">
      {charges.map((c) => (
        <div key={c.id} className="flex items-center gap-3 p-3">
          <ServiceFavicon vendorUrl={c.vendorUrl} name={c.serviceName} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium">{c.serviceName}</span>
              {c.overdue && <Badge variant="destructive">Просрочено</Badge>}
            </div>
            <div className="text-xs text-muted-foreground">
              Ожидается {formatDate(c.expectedDate)}
            </div>
          </div>
          <div className="text-right">
            <div className="tabular-nums font-medium">
              {formatMoney(c.expectedAmount, c.currency)}
            </div>
            {c.currency !== baseCurrency && (
              <div className="text-xs text-muted-foreground tabular-nums">
                ≈ {formatMoney(c.amountBase, baseCurrency)}
              </div>
            )}
          </div>
          {canEdit && (
            <div className="flex gap-1">
              <Button
                size="sm"
                onClick={() => setConfirming(c)}
                aria-label="Подтвердить"
              >
                <Check className="size-4" /> Подтвердить
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setWaiving(c)}
                aria-label="Списания не было"
                title="Списания не было (waived)"
              >
                <Ban className="size-4" />
              </Button>
            </div>
          )}
        </div>
      ))}

      {confirming && (
        <ConfirmDialog
          key={confirming.id}
          charge={confirming}
          onClose={() => setConfirming(null)}
        />
      )}
      {waiving && (
        <WaiveDialog
          key={waiving.id}
          charge={waiving}
          onClose={() => setWaiving(null)}
        />
      )}
    </div>
  );
}

function ConfirmDialog({
  charge,
  onClose,
}: {
  charge: ExpectedCharge;
  onClose: () => void;
}) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    confirmExpectedPayment,
    null
  );

  React.useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success(state.message ?? "Подтверждено");
      onClose();
    } else toast.error(state.error);
  }, [state, onClose]);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <form action={formAction} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Подтвердить списание — {charge.serviceName}</DialogTitle>
            <DialogDescription>
              Создаётся платёж. Скорректированная сумма/дата дадут дельту в отчёте.
            </DialogDescription>
          </DialogHeader>
          <input type="hidden" name="planLineId" value={charge.id} />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cp-amount">Сумма ({charge.currency})</Label>
              <Input
                id="cp-amount"
                name="amount"
                type="number"
                step="0.01"
                min="0"
                defaultValue={charge.expectedAmount}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cp-date">Дата платежа</Label>
              <Input
                id="cp-date"
                name="paidAt"
                type="date"
                defaultValue={charge.expectedDate.slice(0, 10)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cp-comment">Комментарий</Label>
            <Input id="cp-comment" name="comment" placeholder="Необязательно" />
          </div>
          <DialogFooter>
            <SubmitButton>Подтвердить и создать платёж</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function WaiveDialog({
  charge,
  onClose,
}: {
  charge: ExpectedCharge;
  onClose: () => void;
}) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    waivePlanLine,
    null
  );

  React.useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success(state.message ?? "Готово");
      onClose();
    } else toast.error(state.error);
  }, [state, onClose]);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <form action={formAction} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Списания не было — {charge.serviceName}</DialogTitle>
            <DialogDescription>
              Строка плана будет помечена «waived» (это нормально). Укажите причину.
            </DialogDescription>
          </DialogHeader>
          <input type="hidden" name="planLineId" value={charge.id} />
          <div className="space-y-2">
            <Label htmlFor="wv-comment">Комментарий</Label>
            <Input
              id="wv-comment"
              name="comment"
              placeholder="Например: перешли на годовой тариф"
              autoFocus
            />
          </div>
          <DialogFooter>
            <SubmitButton variant="secondary">Пометить waived</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
