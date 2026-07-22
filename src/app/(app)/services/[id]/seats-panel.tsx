"use client";

import * as React from "react";
import { useActionState, useTransition } from "react";
import Link from "next/link";
import { UserPlus, X } from "lucide-react";
import { toast } from "sonner";

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
import { addSeat, endSeat, reopenSeat, markSeatUsed } from "@/lib/actions/seats";
import { formatMoney, formatDate } from "@/lib/format";
import type { ActionResult } from "@/lib/actions/types";

export type SeatRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  seatPrice: number;
  startedAt: string;
  endedAt: string | null;
  lastUsedAt: string | null;
};

export function SeatsPanel({
  serviceId,
  hasSeats,
  seatPriceDefault,
  currency,
  seats,
  employees,
  canEdit,
}: {
  serviceId: string;
  hasSeats: boolean;
  seatPriceDefault: string | null;
  currency: string;
  seats: SeatRow[];
  employees: { email: string; fullName: string }[];
  canEdit: boolean;
}) {
  const active = seats.filter((s) => !s.endedAt);
  const closed = seats.filter((s) => s.endedAt);

  if (!hasSeats) {
    return (
      <p className="text-sm text-muted-foreground">
        У сервиса с моделью «Фиксированный» нет мест.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {canEdit && (
        <AddSeatForm
          serviceId={serviceId}
          seatPriceDefault={seatPriceDefault}
          employees={employees}
        />
      )}

      <div className="space-y-2">
        <h3 className="text-sm font-medium">Активные места ({active.length})</h3>
        {active.length === 0 ? (
          <p className="text-sm text-muted-foreground">Активных мест нет.</p>
        ) : (
          <SeatTable
            rows={active}
            currency={currency}
            canEdit={canEdit}
            closed={false}
          />
        )}
      </div>

      {closed.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            Закрытые места ({closed.length})
          </h3>
          <SeatTable
            rows={closed}
            currency={currency}
            canEdit={canEdit}
            closed
          />
        </div>
      )}
    </div>
  );
}

function AddSeatForm({
  serviceId,
  seatPriceDefault,
  employees,
}: {
  serviceId: string;
  seatPriceDefault: string | null;
  employees: { email: string; fullName: string }[];
}) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    addSeat,
    null
  );
  const formRef = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success(state.message ?? "Место добавлено");
      formRef.current?.reset();
    } else {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-wrap items-end gap-3 rounded-md border p-4"
    >
      <input type="hidden" name="serviceId" value={serviceId} />
      <div className="flex-1 min-w-56 space-y-2">
        <Label htmlFor="seat-email">Email сотрудника</Label>
        <Input
          id="seat-email"
          name="email"
          type="email"
          list="employees-list"
          placeholder="name@company.com"
          required
        />
        <datalist id="employees-list">
          {employees.map((e) => (
            <option key={e.email} value={e.email}>
              {e.fullName}
            </option>
          ))}
        </datalist>
      </div>
      <div className="w-40 space-y-2">
        <Label htmlFor="seat-price">Цена места</Label>
        <Input
          id="seat-price"
          name="seatPrice"
          type="number"
          step="0.01"
          min="0"
          placeholder={seatPriceDefault ?? "0"}
        />
      </div>
      <SubmitButton>
        <UserPlus className="size-4" /> Добавить место
      </SubmitButton>
      <p className="w-full text-xs text-muted-foreground">
        Новый email → сотрудник создаётся автоматически. Пустая цена = цена по
        умолчанию.
      </p>
    </form>
  );
}

function SeatTable({
  rows,
  currency,
  canEdit,
  closed,
}: {
  rows: SeatRow[];
  currency: string;
  canEdit: boolean;
  closed: boolean;
}) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Сотрудник</TableHead>
            <TableHead className="text-right">Цена/цикл</TableHead>
            <TableHead>Начало</TableHead>
            {!closed && <TableHead>Активность</TableHead>}
            <TableHead>{closed ? "Закрыто" : "Действия"}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((s) => (
            <TableRow key={s.id} className={closed ? "opacity-60" : ""}>
              <TableCell>
                <Link
                  href={`/employees/${s.employeeId}`}
                  className="font-medium hover:underline"
                >
                  {s.employeeName}
                </Link>
                <div className="text-xs text-muted-foreground">
                  {s.employeeEmail}
                </div>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatMoney(s.seatPrice, currency)}
              </TableCell>
              <TableCell className="text-sm">{formatDate(s.startedAt)}</TableCell>
              {!closed && (
                <TableCell className="text-sm text-muted-foreground">
                  {s.lastUsedAt ? formatDate(s.lastUsedAt) : "нет отметки"}
                </TableCell>
              )}
              <TableCell>
                {closed ? (
                  <Badge variant="outline">{formatDate(s.endedAt)}</Badge>
                ) : canEdit ? (
                  <div className="flex gap-1">
                    <MarkUsedButton seatId={s.id} />
                    <EndSeatButton seatId={s.id} employee={s.employeeName} />
                  </div>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function MarkUsedButton({ seatId }: { seatId: string }) {
  const [pending, startTransition] = useTransition();
  const mark = () =>
    startTransition(async () => {
      const fd = new FormData();
      fd.set("seatId", seatId);
      const res = await markSeatUsed(null, fd);
      if (res.ok) toast.success(res.message ?? "Отмечено");
      else toast.error(res.error);
    });
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={mark}
      title="Отметить активность (сейчас)"
    >
      Активность
    </Button>
  );
}

function EndSeatButton({
  seatId,
  employee,
}: {
  seatId: string;
  employee: string;
}) {
  const [pending, startTransition] = useTransition();

  const doEnd = () => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("seatId", seatId);
      const res = await endSeat(null, fd);
      if (res.ok) {
        toast.success(`Место закрыто (${employee})`, {
          action: {
            label: "Отменить",
            onClick: () => {
              startTransition(async () => {
                const ufd = new FormData();
                ufd.set("seatId", seatId);
                const ures = await reopenSeat(null, ufd);
                if (ures.ok) toast.success("Закрытие отменено");
                else toast.error(ures.error);
              });
            },
          },
        });
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={doEnd}
      className="text-destructive hover:text-destructive"
    >
      <X className="size-4" /> Закрыть
    </Button>
  );
}
