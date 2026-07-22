// Небольшой надёжный парсер CSV: кавычки, экранирование "", переводы строк
// внутри кавычек, автоопределение разделителя ; или ,.

export type ParsedCsv = {
  headers: string[];
  records: Record<string, string>[];
  delimiter: string;
};

function detectDelimiter(firstLine: string): string {
  const semi = (firstLine.match(/;/g) ?? []).length;
  const comma = (firstLine.match(/,/g) ?? []).length;
  return semi > comma ? ";" : ",";
}

function tokenizeRows(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch === "\r") {
      // игнорируем — \r\n обрабатывается через \n
    } else {
      field += ch;
    }
  }
  // последнее поле/строка
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function parseCsv(input: string): ParsedCsv {
  const text = input.replace(/^﻿/, "");
  if (text.trim() === "") return { headers: [], records: [], delimiter: "," };

  const firstLineEnd = text.indexOf("\n");
  const firstLine = firstLineEnd === -1 ? text : text.slice(0, firstLineEnd);
  const delimiter = detectDelimiter(firstLine);

  const rows = tokenizeRows(text, delimiter).filter(
    (r) => r.length > 1 || (r[0] ?? "").trim() !== ""
  );
  if (rows.length === 0) return { headers: [], records: [], delimiter };

  const headers = rows[0]!.map((h) => h.trim());
  const records: Record<string, string>[] = [];
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i]!;
    const rec: Record<string, string> = {};
    headers.forEach((h, idx) => {
      rec[h] = (cells[idx] ?? "").trim();
    });
    records.push(rec);
  }
  return { headers, records, delimiter };
}
