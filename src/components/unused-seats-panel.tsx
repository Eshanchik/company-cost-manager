"use client";

import * as React from "react";
import { useTransition } from "react";
import Link from "next/link";
import { X, Check } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { endSeat, markSeatUsed } from "@/lib/actions/seats";
import { formatMoney } from "@/lib/format";
import { UNUSED_REASON_LABEL, type UnusedSeat } from "@/lib/seats/unused";

export function UnusedSeatsPanel({
  seats,
  canEdit,
}: {
  seats: UnusedSeat[];
  canEdit: boolean;
}) {
  if (seats.length === 0) return null;

  const total = new Map<string, number>();
  for (const s of seats)
    total.set(s.currency, (total.get(s.currency) ?? 0) + s.monthly);
  const totalStr = [...total.entries()]
    .map(([c, a]) => formatMoney(a, c))
    .join(" + ");

  return (
    <div>
      <h3 className="mb-1 text-sm font-medium">
        Неиспользуемые места ({seats.length}) · впустую ~{totalStr}/мес
      </h3>
      <ul className="space-y-1 text-sm">
        {seats.map((s) => (
          <li key={s.seatId} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2">
              <Badge
                variant={s.reason === "offboarded" ? "destructive" : "secondary"}
              >
                {UNUSED_REASON_LABEL[s.reason]}
              </Badge>
              <Link href={`/services/${s.serviceId}`} className="hover:underline">
                {s.serviceName}
              </Link>
              <span className="truncate text-muted-foreground">
                · {s.employeeName}
              </span>
            </span>
            <span className="flex items-center gap-2">
              <span className="tabular-nums text-muted-foreground">
                {formatMoney(s.monthly, s.currency)}/мес
              </span>
              {canEdit && <SeatActions seat={s} />}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SeatActions({ seat }: { seat: UnusedSeat }) {
  const [pending, startTransition] = useTransition();

  const run = (fn: typeof endSeat, okMsg: string) =>
    startTransition(async () => {
      const fd = new FormData();
      fd.set("seatId", seat.seatId);
      const res = await fn(null, fd);
      if (res.ok) toast.success(res.message ?? okMsg);
      else toast.error(res.error);
    });

  return (
    <span className="flex gap-1">
      {seat.reason === "idle" && (
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => run(markSeatUsed, "Отмечено")}
          title="Отметить активность"
        >
          <Check className="size-4" />
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => run(endSeat, "Место закрыто")}
        className="text-destructive hover:text-destructive"
        title="Закрыть место"
      >
        <X className="size-4" />
      </Button>
    </span>
  );
}
