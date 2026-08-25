"use client";

import * as React from "react";
import { useActionState } from "react";
import { toast } from "sonner";

import type { BillingModel, BillingCycle, ServiceStatus } from "@prisma/client";
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
import { createService, updateService } from "@/lib/actions/services";
import { SUPPORTED_CURRENCIES } from "@/lib/currencies";
import {
  BILLING_MODEL_LABEL,
  BILLING_CYCLE_LABEL,
  STATUS_LABEL,
} from "@/lib/service-display";
import type { ActionResult } from "@/lib/actions/types";

export type ServiceDefaults = {
  id: string;
  kind: "service" | "domain";
  registrar: string;
  autoRenew: boolean;
  name: string;
  vendorUrl: string;
  categoryId: string;
  description: string;
  billingModel: BillingModel;
  billingCycle: BillingCycle;
  price: string;
  seatPriceDefault: string;
  currency: string;
  billingDay: string;
  renewalDate: string; // YYYY-MM-DD
  prepaidUntil: string; // YYYY-MM-DD, «оплачено вперёд до»
  paymentMethodId: string;
  ownerId: string;
  backupOwnerId: string;
  status: ServiceStatus;
  cancellationNoticeDays: string;
  tags: string;
  notes: string;
};

export type ServiceOptions = {
  categories: { id: string; name: string }[];
  owners: { id: string; label: string }[];
  methods: { id: string; name: string; isArchived: boolean }[];
};

export function ServiceDialog({
  open,
  onOpenChange,
  service,
  options,
  kind = "service",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  service: ServiceDefaults | null;
  options: ServiceOptions;
  /** Вид создаваемой записи: обычный сервис или домен. */
  kind?: "service" | "domain";
}) {
  const action = service ? updateService : createService;
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    action,
    null
  );
  const [model, setModel] = React.useState<BillingModel>(
    service?.billingModel ?? (kind === "domain" ? "fixed" : "per_seat")
  );
  const [cycle, setCycle] = React.useState<BillingCycle>(
    service?.billingCycle ?? (kind === "domain" ? "yearly" : "monthly")
  );
  const effectiveKind = service?.kind ?? kind;
  const isDomain = effectiveKind === "domain";
  // У домена модель всегда «фиксированная» — поля мест не показываем.
  const effectiveModel: BillingModel = isDomain ? "fixed" : model;

  React.useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success(state.message ?? "Готово");
      onOpenChange(false);
    } else {
      toast.error(state.error);
    }
  }, [state, onOpenChange]);

  const activeMethods = options.methods.filter(
    (m) => !m.isArchived || m.id === service?.paymentMethodId
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <form action={formAction} className="space-y-4">
          <DialogHeader>
            <DialogTitle>
              {service
                ? isDomain
                  ? "Изменить домен"
                  : "Изменить сервис"
                : isDomain
                  ? "Новый домен"
                  : "Новый сервис"}
            </DialogTitle>
            <DialogDescription>
              {isDomain
                ? "Домен, регистратор и дата продления. Стоимость учитывается в общих расходах."
                : "Подписка и параметры списаний."}
            </DialogDescription>
          </DialogHeader>
          {service && <input type="hidden" name="id" value={service.id} />}
          <input type="hidden" name="kind" value={effectiveKind} />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Название" className="sm:col-span-2">
              <Input name="name" defaultValue={service?.name} required autoFocus />
            </Field>
            <Field label="Ссылка на вендора (для логотипа)">
              <Input
                name="vendorUrl"
                defaultValue={service?.vendorUrl}
                placeholder="https://figma.com"
              />
            </Field>
            <Field label="Категория">
              <NativeSelect name="categoryId" defaultValue={service?.categoryId ?? ""}>
                <option value="">— без категории —</option>
                {options.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>

            <Field label="Модель биллинга">
              {/* disabled-поля не попадают в FormData — для домена
                  отправляем значение скрытым инпутом. */}
              {isDomain && (
                <input type="hidden" name="billingModel" value="fixed" />
              )}
              <NativeSelect
                name={isDomain ? undefined : "billingModel"}
                value={effectiveModel}
                disabled={isDomain}
                onChange={(e) => setModel(e.target.value as BillingModel)}
              >
                {(["fixed", "per_seat", "hybrid"] as const).map((m) => (
                  <option key={m} value={m}>
                    {BILLING_MODEL_LABEL[m]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Цикл">
              <NativeSelect
                name="billingCycle"
                value={cycle}
                onChange={(e) => setCycle(e.target.value as BillingCycle)}
              >
                {(["monthly", "quarterly", "yearly"] as const).map((c) => (
                  <option key={c} value={c}>
                    {BILLING_CYCLE_LABEL[c]}
                  </option>
                ))}
              </NativeSelect>
            </Field>

            {effectiveModel !== "per_seat" && (
              <Field label="Фикс. цена (за цикл)">
                <Input
                  name="price"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={service?.price ?? "0"}
                />
              </Field>
            )}
            {effectiveModel !== "fixed" && (
              <Field label="Цена места (за цикл)">
                <Input
                  name="seatPriceDefault"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={service?.seatPriceDefault ?? ""}
                />
              </Field>
            )}

            <Field label="Валюта">
              <NativeSelect name="currency" defaultValue={service?.currency ?? "USD"}>
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </NativeSelect>
            </Field>

            {cycle === "monthly" ? (
              <Field label="День списания (1–31)">
                <Input
                  name="billingDay"
                  type="number"
                  min="1"
                  max="31"
                  defaultValue={service?.billingDay ?? ""}
                />
              </Field>
            ) : (
              <Field
                label={
                  cycle === "quarterly"
                    ? "Опорная дата списания"
                    : isDomain
                      ? "Дата продления домена"
                      : "Дата продления"
                }
              >
                <Input
                  name="renewalDate"
                  type="date"
                  defaultValue={service?.renewalDate ?? ""}
                />
                {cycle === "quarterly" && (
                  <p className="text-xs text-muted-foreground">
                    Любое известное списание — задаёт день и фазу квартала.
                  </p>
                )}
              </Field>
            )}

            <Field label="Ответственный">
              <NativeSelect name="ownerId" defaultValue={service?.ownerId ?? ""} required>
                <option value="" disabled>
                  — выберите —
                </option>
                {options.owners.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Резервный ответственный">
              <NativeSelect
                name="backupOwnerId"
                defaultValue={service?.backupOwnerId ?? ""}
              >
                <option value="">— нет —</option>
                {options.owners.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>

            <Field label="Способ оплаты">
              <NativeSelect
                name="paymentMethodId"
                defaultValue={service?.paymentMethodId ?? ""}
              >
                <option value="">— не указан —</option>
                {activeMethods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Статус">
              <NativeSelect name="status" defaultValue={service?.status ?? "active"}>
                {(["active", "paused", "cancelled", "archived"] as const).map(
                  (s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  )
                )}
              </NativeSelect>
            </Field>

            {cycle === "yearly" && (
              <Field label="Уведомление об отмене, дней">
                <Input
                  name="cancellationNoticeDays"
                  type="number"
                  min="0"
                  max="365"
                  defaultValue={service?.cancellationNoticeDays ?? "30"}
                />
              </Field>
            )}
            {isDomain && (
              <Field label="Регистратор">
                <Input
                  name="registrar"
                  defaultValue={service?.registrar ?? ""}
                  placeholder="Namecheap, Cloudflare…"
                />
              </Field>
            )}
            {isDomain && (
              <Field label="Авто-продление">
                <label className="flex h-9 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="autoRenew"
                    defaultChecked={service?.autoRenew ?? true}
                    className="size-4"
                  />
                  Включено у регистратора
                </label>
              </Field>
            )}
            <Field label="Оплачено вперёд до">
              <Input
                name="prepaidUntil"
                type="date"
                defaultValue={service?.prepaidUntil ?? ""}
              />
              <p className="text-xs text-muted-foreground">
                Списания по эту дату включительно не планируются — сервис уже
                проплачен.
              </p>
            </Field>
            <Field label="Теги (через запятую)">
              <Input name="tags" defaultValue={service?.tags} placeholder="ai, design" />
            </Field>

            <Field label="Описание" className="sm:col-span-2">
              <Input name="description" defaultValue={service?.description} />
            </Field>
            <Field label="Заметки" className="sm:col-span-2">
              <Input name="notes" defaultValue={service?.notes} />
            </Field>
          </div>

          <DialogFooter>
            <SubmitButton>{service ? "Сохранить" : "Создать"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
