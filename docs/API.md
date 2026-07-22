# REST API `/api/v1/*`

Аутентификация — заголовок `Authorization: Bearer <token>`. Токены создаёт Admin
в **Настройки → API-токены** (значение показывается один раз). Операции записи
требуют роль **Manager+** (§1). Ответы — компактный JSON; суммы — в исходной
валюте плюс пересчёт в базовую.

```bash
curl https://<host>/api/v1/whoami -H "Authorization: Bearer st_…"
```

| Метод | Путь | Доступ | Назначение |
|---|---|---|---|
| GET | `/whoami` | все | Имя и роль токена |
| GET | `/overview` | все | Сводка: run-rate, прогноз, ожидаемые, «требует внимания» |
| GET | `/services?status=&category=&owner=&q=` | все | Список сервисов |
| POST | `/services` | Manager+ | Создать сервис |
| GET | `/services/{id}` | все | Карточка сервиса + активные места |
| PATCH | `/services/{id}` | Manager+ | Обновить сервис (полный объект) |
| POST | `/services/{id}/archive` | Manager+ | `{archived: true|false}` |
| GET | `/seats?service_id=&email=` | все | Активные места |
| POST | `/seats` | Manager+ | Добавить место (автосоздание сотрудника) |
| POST | `/seats/{id}/end` | Manager+ | Закрыть место |
| GET | `/employees` | все | Список сотрудников |
| GET | `/employees/costs?id=&email=` | все | Стоимость мест сотрудника |
| POST | `/payments` | Manager+ | Ручной платёж |
| POST | `/payments/confirm` | Manager+ | Подтвердить строку плана |
| GET | `/reports/monthly?month=YYYY-MM&view=cashflow\|normalized` | все | Отчёт план/факт |
| GET | `/costs-summary?group_by=category\|owner\|vendor\|billing_cycle&from=&to=` | все | Сумма факта за период |
| GET | `/upcoming-payments?days=30` | все | Ближайшие списания |
| GET | `/needs-attention` | все | Просрочки + годовые в окне решения |
| GET | `/export?kind=services\|employees\|payments&format=csv\|json` | все | Выгрузка |

### Пример: создать сервис (Manager+)

```bash
curl -X POST https://<host>/api/v1/services \
  -H "Authorization: Bearer st_…" -H "Content-Type: application/json" \
  -d '{"name":"Miro","billing_model":"per_seat","billing_cycle":"monthly",
       "currency":"USD","seat_price_default":8,"billing_day":5,
       "owner_email":"owner@example.com"}'
```

Коды ошибок: `401` — нет/невалидный токен; `403` — недостаточно прав;
`400` — ошибка валидации; `404` — не найдено; `409` — конфликт (напр. место уже
активно).

> MCP-сервер `/mcp` (Streamable HTTP, Bearer) предоставляет те же операции как
> набор инструментов — см. `docs/SPEC.md` §6.
