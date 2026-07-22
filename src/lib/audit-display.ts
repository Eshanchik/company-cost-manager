export const ENTITY_LABEL: Record<string, string> = {
  Service: "Сервис",
  Seat: "Место",
  Payment: "Платёж",
  Employee: "Сотрудник",
  Category: "Категория",
  PaymentMethod: "Способ оплаты",
  Setting: "Настройки",
  FxRate: "Курс валюты",
  PlanSnapshot: "План-снапшот",
  PlanLine: "Строка плана",
  ApiToken: "API-токен",
  AllowedEmail: "Whitelist",
};

export const ACTION_LABEL: Record<string, string> = {
  create: "Создание",
  update: "Изменение",
  delete: "Удаление",
  archive: "Архивация",
  unarchive: "Из архива",
  end: "Закрытие",
  reopen: "Возврат",
  waive: "Waived",
  confirm_expected: "Подтверждение",
  refresh: "Обновление курсов",
  rebuild: "Пересборка",
  revoke: "Отзыв",
  import: "Импорт",
};

export function entityLabel(e: string): string {
  return ENTITY_LABEL[e] ?? e;
}
export function actionLabel(a: string): string {
  return ACTION_LABEL[a] ?? a;
}
