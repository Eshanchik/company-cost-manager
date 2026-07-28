# Деплой SubTrack рядом с существующим Caddy (пример: сервер вики Outline)

Разворачивание на одном хосте с уже работающим reverse-proxy **Caddy**
(порты 80/443 у Caddy). SubTrack наружу порты не публикует — доступ только через
Caddy по внутренней Docker-сети. TLS — существующий wildcard-сертификат
Cloudflare Origin (`*.gt1.one`).

## Предпосылки (делает владелец инфраструктуры)

1. **Cloudflare DNS:** запись `subtrack.gt1.one` → IP сервера (proxied, оранжевое
   облако). Сертификат `*.gt1.one` уже покрывает поддомен.
2. **Google OAuth-клиент** (console.cloud.google.com → APIs & Services →
   Credentials → OAuth 2.0 Client, тип Web):
   - Authorized redirect URI: `https://subtrack.gt1.one/api/auth/callback/google`
   - Скопировать Client ID и Client secret.

## 1. Код и окружение

```bash
git clone https://github.com/Eshanchik/company-cost-manager.git /opt/subtrack
cd /opt/subtrack
cp .env.production.example .env
# сгенерировать секреты и вписать в .env:
echo "POSTGRES_PASSWORD=$(openssl rand -hex 24)" 
echo "AUTH_SECRET=$(openssl rand -base64 32)"
# затем вписать AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, ADMIN_EMAILS
```

`.env` (минимум): `POSTGRES_PASSWORD`, `AUTH_SECRET`, `AUTH_URL=https://subtrack.gt1.one`,
`AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `ADMIN_EMAILS`, `CADDY_NETWORK=outline_internal`.

## 2. Сборка и запуск

```bash
cd /opt/subtrack
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs -f app   # дождаться migrate deploy + Ready
```

При старте контейнер выполняет `prisma migrate deploy`; демо-данные НЕ засеваются
(`SEED_ON_START=false`). Админы из `ADMIN_EMAILS` попадают в whitelist.

## 3. Маршрут в Caddy

Добавить блок в `/opt/outline/Caddyfile` (сначала сделать бэкап!):

```caddy
subtrack.gt1.one {
	tls /etc/caddy/certs/cert.pem /etc/caddy/certs/key.pem
	encode zstd gzip
	header {
		Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
		X-Content-Type-Options "nosniff"
		Referrer-Policy "strict-origin-when-cross-origin"
		-Server
	}
	reverse_proxy subtrack-app:3000 {
		header_up Host {host}
		header_up X-Real-IP {http.request.header.CF-Connecting-IP}
		header_up X-Forwarded-Proto https
	}
}
```

Применить без даунтайма вики (reload атомарен — при ошибке конфига остаётся
старый):

```bash
cp /opt/outline/Caddyfile /opt/outline/Caddyfile.bak.$(date +%s)
docker exec outline-caddy-1 caddy reload --config /etc/caddy/Caddyfile
```

## 4. Первый вход

Открыть `https://subtrack.gt1.one` → «Войти через Google» под email из
`ADMIN_EMAILS`. Дальше приглашать пользователей: **Настройки → Доступ**.

## 5. Бэкапы (SPEC §2: pg_dump, хранение 30 дней)

```bash
chmod +x /opt/subtrack/scripts/backup.sh
# crontab -e (root):
0 3 * * * /opt/subtrack/scripts/backup.sh >> /var/log/subtrack-backup.log 2>&1
```

## Обновление версии

```bash
cd /opt/subtrack && git pull
docker compose -f docker-compose.prod.yml up -d --build
docker image prune -f
```

## Замечания

- Порты `3000`/`5432` наружу не публикуются; БД — во внутренней сети `db`.
- `E2E_TEST_AUTH` в проде не задавать (иначе включится тестовый вход без Google).
- Курсы валют (cron 07:00) требуют исходящего HTTPS до `api.frankfurter.app`.
