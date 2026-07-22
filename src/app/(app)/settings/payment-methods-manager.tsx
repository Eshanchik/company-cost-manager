"use client";

import * as React from "react";
import { useActionState } from "react";
import { Archive, ArchiveRestore, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import type { PaymentMethod } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createPaymentMethod,
  updatePaymentMethod,
  setPaymentMethodArchived,
} from "@/lib/actions/payment-methods";
import type { ActionResult } from "@/lib/actions/types";

export function PaymentMethodsManager({
  methods,
}: {
  methods: PaymentMethod[];
}) {
  const [editing, setEditing] = React.useState<PaymentMethod | null>(null);
  const [open, setOpen] = React.useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Способы оплаты (карты, счета, PayPal). Вместо удаления — архивация.
        </p>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="size-4" /> Добавить
        </Button>
      </div>

      {methods.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          Пока нет способов оплаты.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Название</TableHead>
              <TableHead>Заметка</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead className="w-24 text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {methods.map((m) => (
              <TableRow key={m.id} className={m.isArchived ? "opacity-60" : ""}>
                <TableCell className="font-medium">{m.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {m.note ?? "—"}
                </TableCell>
                <TableCell>
                  {m.isArchived ? (
                    <Badge variant="secondary">В архиве</Badge>
                  ) : (
                    <Badge variant="outline">Активен</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Изменить"
                      onClick={() => {
                        setEditing(m);
                        setOpen(true);
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <ArchiveButton method={m} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <MethodDialog
        key={editing?.id ?? "new"}
        open={open}
        onOpenChange={setOpen}
        method={editing}
      />
    </div>
  );
}

function MethodDialog({
  open,
  onOpenChange,
  method,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  method: PaymentMethod | null;
}) {
  const action = method ? updatePaymentMethod : createPaymentMethod;
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    action,
    null
  );

  React.useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success(state.message ?? "Готово");
      onOpenChange(false);
    } else {
      toast.error(state.error);
    }
  }, [state, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form action={formAction} className="space-y-4">
          <DialogHeader>
            <DialogTitle>
              {method ? "Изменить способ оплаты" : "Новый способ оплаты"}
            </DialogTitle>
            <DialogDescription>
              Например, «Карта ****1234 (Иван)» или «Счёт ФОП».
            </DialogDescription>
          </DialogHeader>
          {method && <input type="hidden" name="id" value={method.id} />}
          <div className="space-y-2">
            <Label htmlFor="pm-name">Название</Label>
            <Input
              id="pm-name"
              name="name"
              defaultValue={method?.name ?? ""}
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pm-note">Заметка</Label>
            <Input
              id="pm-note"
              name="note"
              defaultValue={method?.note ?? ""}
              placeholder="Необязательно"
            />
          </div>
          <DialogFooter>
            <SubmitButton>{method ? "Сохранить" : "Создать"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ArchiveButton({ method }: { method: PaymentMethod }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    setPaymentMethodArchived,
    null
  );

  React.useEffect(() => {
    if (!state) return;
    if (state.ok) toast.success(state.message ?? "Готово");
    else toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={method.id} />
      <input
        type="hidden"
        name="archived"
        value={(!method.isArchived).toString()}
      />
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        aria-label={method.isArchived ? "Вернуть из архива" : "В архив"}
        title={method.isArchived ? "Вернуть из архива" : "В архив"}
      >
        {method.isArchived ? (
          <ArchiveRestore className="size-4" />
        ) : (
          <Archive className="size-4" />
        )}
      </Button>
    </form>
  );
}
