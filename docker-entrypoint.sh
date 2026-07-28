#!/bin/sh
set -e

echo "→ Применяю миграции базы данных (prisma migrate deploy)…"
# Зовём CLI по прямому пути пакета: symlink node_modules/.bin/prisma при копии в
# standalone-образ разрешается в файл, и CLI не находит рядом свой .wasm.
node node_modules/prisma/build/index.js migrate deploy

# Идемпотентный сид демо-данными (безопасно при повторном старте).
# В контейнере нет tsx (devDependency) — исполняем seed нативным Node
# со снятием типов (Node 22 `--experimental-strip-types`).
if [ "${SEED_ON_START:-true}" = "true" ]; then
  echo "→ Наполняю демо-данными (db seed)…"
  node --experimental-strip-types prisma/seed.ts || echo "  seed пропущен/уже применён"
fi

echo "→ Стартую приложение…"
exec "$@"
