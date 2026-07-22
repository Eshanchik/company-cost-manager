# SubTrack

Внутренний трекер SaaS-подписок компании: сервисы, стоимость, места сотрудников,
ответственные, план/факт расходов по месяцам. Self-hosted, одна компания на инстанс.

Полные требования — [`docs/SPEC.md`](docs/SPEC.md). План работ — [`docs/PLAN.md`](docs/PLAN.md).

## Стек

Next.js 15 (App Router) · TypeScript strict · PostgreSQL 16 + Prisma · Auth.js v5
(Google + whitelist) · Tailwind + shadcn/ui · Recharts · MCP `@modelcontextprotocol/sdk` ·
cron `croner` · Vitest + Playwright · Docker Compose.

## Быстрый старт (разработка)

Нужны Node 22+ и Postgres (проще всего — поднять только БД через Docker).

```bash
# 1. Переменные окружения
cp .env.example .env        # заполните AUTH_GOOGLE_ID/SECRET, ADMIN_EMAILS

# 2. Зависимости
npm install

# 3. База данных: поднять Postgres и применить схему
docker compose up -d postgres
npm run db:migrate          # применит миграции
npm run db:seed             # демо-данные (~12 сервисов, места, платежи)

# 4. Дев-сервер
npm run dev                 # http://localhost:3000
```

## Полный запуск в Docker

```bash
cp .env.example .env        # заполните секреты
docker compose up -d        # postgres + app; при старте: migrate deploy + seed
# приложение на http://localhost:3000
```

Контейнер `app` при старте выполняет `prisma migrate deploy` и идемпотентный сид
(отключается переменной `SEED_ON_START=false`).

## Команды

| Команда | Назначение |
|---|---|
| `npm run dev` | дев-сервер |
| `npm run build` | production-сборка |
| `npm test` | unit-тесты (Vitest) |
| `npm run test:e2e` | e2e smoke (Playwright) |
| `npm run lint` | линтер |
| `npm run typecheck` | проверка типов (tsc) |
| `npm run db:migrate` | миграции (dev) |
| `npm run db:deploy` | миграции (prod) |
| `npm run db:seed` | демо-данные |
| `npm run db:studio` | просмотр БД (Prisma Studio) |

## Переменные окружения

См. [`.env.example`](.env.example): `DATABASE_URL`, `AUTH_SECRET`,
`AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`, `NEXTAUTH_URL`, `ADMIN_EMAILS`, `APP_TZ`,
`BASE_CURRENCY`.

## Прогресс по этапам

Разработка ведётся блоками по [`docs/PLAN.md`](docs/PLAN.md). Текущий статус — там же
в чекбоксах.
