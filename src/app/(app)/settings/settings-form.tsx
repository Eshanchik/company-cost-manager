"use client";

import * as React from "react";
import { useActionState } from "react";
import { toast } from "sonner";

import type { Setting } from "@prisma/client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { updateSettings } from "@/lib/actions/settings";
import { SUPPORTED_CURRENCIES } from "@/lib/currencies";
import type { ActionResult } from "@/lib/actions/types";

export function SettingsForm({ settings }: { settings: Setting }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    updateSettings,
    null
  );

  React.useEffect(() => {
    if (!state) return;
    if (state.ok) toast.success(state.message ?? "Сохранено");
    else toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="max-w-md space-y-6">
      <div className="space-y-2">
        <Label htmlFor="baseCurrency">Базовая валюта отчётов</Label>
        <select
          id="baseCurrency"
          name="baseCurrency"
          defaultValue={settings.baseCurrency}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {SUPPORTED_CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Все суммы и итоги пересчитываются в эту валюту.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmationOverdueDays">
          Срок «просрочки» подтверждения, дней
        </Label>
        <Input
          id="confirmationOverdueDays"
          name="confirmationOverdueDays"
          type="number"
          min={0}
          max={60}
          defaultValue={settings.confirmationOverdueDays}
        />
        <p className="text-xs text-muted-foreground">
          Через сколько дней после ожидаемой даты списание считается
          просроченным (по умолчанию 5).
        </p>
      </div>

      <SubmitButton>Сохранить</SubmitButton>
    </form>
  );
}
