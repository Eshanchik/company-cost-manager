// Валюты, поддерживаемые как базовые (ISO 4217).
export const SUPPORTED_CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "UAH",
  "PLN",
] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];
