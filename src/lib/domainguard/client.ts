/**
 * Клиент реестра доменов DomainGuard.
 * Доступен только read-only API: /api/v1/{me,domains,alerts} с Bearer-токеном.
 * Секреты — строго из env (§ CLAUDE.md), в репозиторий не попадают.
 */

export type DgDomain = {
  id: number;
  project_id: number;
  fqdn: string;
  punycode: string | null;
  tld: string | null;
  expiry_date: string | null;
  auto_renew: boolean;
  is_active: boolean;
  renewal_price: string | null;
  renewal_currency: string | null;
  created_at: string;
};

export type DgConfig = {
  baseUrl: string;
  token: string;
  /** Проекты, попадающие в синхронизацию (компания GT1). */
  projectIds: number[];
};

export class DomainGuardError extends Error {}

/** Конфигурация из env; null — если интеграция не настроена. */
export function readDgConfig(): DgConfig | null {
  const baseUrl = process.env.DOMAINGUARD_URL?.replace(/\/+$/, "");
  const token = process.env.DOMAINGUARD_TOKEN;
  if (!baseUrl || !token) return null;
  const projectIds = (process.env.DOMAINGUARD_PROJECT_IDS ?? "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  return { baseUrl, token, projectIds };
}

async function dgGet<T>(cfg: DgConfig, path: string): Promise<T> {
  const res = await fetch(`${cfg.baseUrl}${path}`, {
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new DomainGuardError(
      `DomainGuard ${path} → HTTP ${res.status}`
    );
  }
  return (await res.json()) as T;
}

/** Кто мы в реестре — для проверки токена. */
export async function dgWhoami(
  cfg: DgConfig
): Promise<{ id: number; login: string; email: string; role: string }> {
  return dgGet(cfg, "/api/v1/me");
}

/** Все домены реестра (постранично). */
export async function fetchAllDomains(cfg: DgConfig): Promise<DgDomain[]> {
  const pageSize = 200;
  const out: DgDomain[] = [];
  for (let page = 1; page <= 100; page++) {
    const data = await dgGet<{
      total: number;
      page: number;
      page_size: number;
      items: DgDomain[];
    }>(cfg, `/api/v1/domains?page=${page}&page_size=${pageSize}`);
    out.push(...data.items);
    if (out.length >= data.total || data.items.length === 0) break;
  }
  return out;
}
