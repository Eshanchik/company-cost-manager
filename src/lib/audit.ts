import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

type AuditInput = {
  entity: string;
  entityId: string;
  actor: string;
  action: string;
  diff?: Prisma.InputJsonValue | null;
};

/**
 * Запись в аудит-лог (§3.10). Вызывается из всех мутаций Service / Seat /
 * Payment / Employee / справочников / настроек / whitelist.
 *
 * `tx` — опциональный транзакционный клиент; если передан, запись идёт в той же
 * транзакции, что и само изменение.
 */
export async function writeAudit(
  input: AuditInput,
  tx: Prisma.TransactionClient | typeof prisma = prisma
): Promise<void> {
  await tx.auditLog.create({
    data: {
      entity: input.entity,
      entityId: input.entityId,
      actor: input.actor,
      action: input.action,
      diff: input.diff ?? undefined,
    },
  });
}

type JsonPrimitive = string | number | boolean | null;

/**
 * Строит diff old → new только по изменившимся полям. Значения нормализуются к
 * JSON-примитивам (Decimal/Date → строка), результат совместим с Prisma JSON.
 */
export function buildDiff<T extends Record<string, unknown>>(
  before: T | null,
  after: T,
  fields: (keyof T)[]
): Record<string, { from: JsonPrimitive; to: JsonPrimitive }> {
  const diff: Record<string, { from: JsonPrimitive; to: JsonPrimitive }> = {};
  for (const f of fields) {
    const from = before ? normalize(before[f]) : null;
    const to = normalize(after[f]);
    if (from !== to) {
      diff[String(f)] = { from, to };
    }
  }
  return diff;
}

function normalize(v: unknown): JsonPrimitive {
  if (v === null || v === undefined) return null;
  if (typeof v === "object") {
    if (v instanceof Date) return v.toISOString();
    // Prisma.Decimal и прочие — через toString.
    return String(v);
  }
  if (typeof v === "number" || typeof v === "boolean") return v;
  return String(v);
}
