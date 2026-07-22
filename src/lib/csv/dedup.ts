export type DuplicateReason = "existing" | "in-file";

export type PartitionResult<T> = {
  unique: T[];
  duplicates: { item: T; reason: DuplicateReason }[];
};

/**
 * Делит записи на уникальные и дубли (§7): дубль — если ключ уже есть в БД
 * (`existing`, reason "existing") или повторяется в самом файле (reason
 * "in-file"). Ключи нормализуются (trim + lower).
 */
export function partitionUnique<T>(
  items: T[],
  keyOf: (t: T) => string,
  existing: Iterable<string> = []
): PartitionResult<T> {
  const norm = (s: string) => s.trim().toLowerCase();
  const existingSet = new Set<string>();
  for (const k of existing) existingSet.add(norm(k));

  const seenInFile = new Set<string>();
  const unique: T[] = [];
  const duplicates: { item: T; reason: DuplicateReason }[] = [];

  for (const item of items) {
    const key = norm(keyOf(item));
    if (existingSet.has(key)) {
      duplicates.push({ item, reason: "existing" });
      continue;
    }
    if (seenInFile.has(key)) {
      duplicates.push({ item, reason: "in-file" });
      continue;
    }
    seenInFile.add(key);
    unique.push(item);
  }
  return { unique, duplicates };
}
