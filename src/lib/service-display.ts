import type { ServiceStatus, BillingModel, BillingCycle } from "@prisma/client";

export const STATUS_LABEL: Record<ServiceStatus, string> = {
  active: "Активен",
  paused: "На паузе",
  cancelled: "Отменён",
  archived: "В архиве",
};

export const STATUS_VARIANT: Record<
  ServiceStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  active: "default",
  paused: "secondary",
  cancelled: "destructive",
  archived: "outline",
};

export const BILLING_MODEL_LABEL: Record<BillingModel, string> = {
  fixed: "Фиксированный",
  per_seat: "За место",
  hybrid: "Гибрид",
};

export const BILLING_CYCLE_LABEL: Record<BillingCycle, string> = {
  monthly: "Ежемесячно",
  yearly: "Ежегодно",
};
