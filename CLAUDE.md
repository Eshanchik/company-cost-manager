# CLAUDE.md — SubTrack

## Что это
Внутренний трекер SaaS-подписок компании: сервисы, стоимость, места сотрудников, ответственные, план/факт расходов по месяцам, MCP-сервер для AI-ассистентов.

- **docs/SPEC.md** — полные требования, источник истины. Ничего сверх него не делаем.
- **docs/PLAN.md** — план текущего этапа с чекбоксами и статус прогресса.

## Стек (зафиксирован, не менять)
Next.js 15 (App Router) + TypeScript strict · PostgreSQL 16 + Prisma · Auth.js v5 (Google + whitelist) · Tailwind CSS + shadcn/ui · Recharts · MCP: `@modelcontextprotocol/sdk` (Streamable HTTP на `/mcp`) · cron: `croner` из `instrumentation.ts` · Vitest + Playwright · Docker Compose.

## Команды (обновляй по мере появления)
- `npm run dev` — дев-сервер
- `npm test` — unit-тесты (Vitest)
- `npm run test:e2e` — Playwright smoke
- `npm run lint` — линтер
- `npx prisma migrate dev` — миграции (dev), `npx prisma studio` — просмотр БД
- `npm run db:seed` — демо-данные
- `docker compose up -d` — полный запуск

## Железные правила
- Деньги — только Prisma `Decimal`, никаких float.
- Вся расчётная логика — чистые функции в `lib/calc/*` с unit-тестами. Компоненты UI деньги не считают.
- План месяца после снапшота задним числом не меняется (SPEC, раздел 3.8).
- Интерфейс только на русском; даты DD.MM.YYYY; таймзона из env `APP_TZ` (по умолчанию Europe/Kyiv).
- CSV-экспорт — UTF-8 with BOM.
- Секреты только в env; `.env.example` всегда актуален; API/MCP-токены в БД — только хэши.
- Аудит-лог пишется на все изменения Service / Seat / Payment / Employee / справочников.

## Процесс
- Работаем блоками по docs/PLAN.md. Завершение блока = тесты и линт зелёные → git-коммит с осмысленным сообщением → отметить чекбокс в docs/PLAN.md.
- С красными тестами дальше не переходить.
- Неоднозначность или противоречие в docs/SPEC.md → остановиться и спросить, не додумывать.
- Этап 2 — только после явного подтверждения пользователя.
- Поддерживай этот файл (команды) и docs/PLAN.md в актуальном состоянии.