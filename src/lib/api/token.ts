import { createHash, randomBytes } from "node:crypto";

import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

const PREFIX = "st_";

export type ApiActor = { tokenName: string; role: Role };

/** Генерирует новый токен: возвращает открытое значение (показать один раз), префикс и хэш. */
export function generateToken(): { token: string; prefix: string; hash: string } {
  const token = PREFIX + randomBytes(24).toString("hex");
  return { token, prefix: token.slice(0, PREFIX.length + 8), hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Аутентификация по заголовку Authorization: Bearer <token>.
 * Возвращает актора (имя + роль) или null. Обновляет lastUsedAt.
 */
export async function authenticateToken(
  authHeader: string | null
): Promise<ApiActor | null> {
  if (!authHeader) return null;
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const token = m[1]!.trim();
  if (!token.startsWith(PREFIX)) return null;

  const hash = hashToken(token);
  const record = await prisma.apiToken.findUnique({ where: { tokenHash: hash } });
  if (!record || record.revokedAt) return null;

  await prisma.apiToken.update({
    where: { id: record.id },
    data: { lastUsedAt: new Date() },
  });
  return { tokenName: record.name, role: record.role };
}
