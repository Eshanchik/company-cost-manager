/** Разбор списка email из textarea: перевод строки, запятая, точка с запятой, пробел. */
export function parseEmailList(input: string): {
  emails: string[];
  invalid: string[];
} {
  const parts = input
    .split(/[\s,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const seen = new Set<string>();
  const emails: string[] = [];
  const invalid: string[] = [];
  const re = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

  for (const p of parts) {
    if (!re.test(p)) {
      if (!invalid.includes(p)) invalid.push(p);
      continue;
    }
    if (seen.has(p)) continue; // дубли внутри списка схлопываем
    seen.add(p);
    emails.push(p);
  }
  return { emails, invalid };
}
