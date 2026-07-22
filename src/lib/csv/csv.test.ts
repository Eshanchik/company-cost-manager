import { describe, it, expect } from "vitest";
import { parseCsv } from "@/lib/csv/parse";
import { partitionUnique } from "@/lib/csv/dedup";

describe("parseCsv", () => {
  it("парсит заголовки и записи (запятая)", () => {
    const r = parseCsv("name,price\nFigma,15\nSlack,8.75");
    expect(r.headers).toEqual(["name", "price"]);
    expect(r.records).toEqual([
      { name: "Figma", price: "15" },
      { name: "Slack", price: "8.75" },
    ]);
  });

  it("автоопределяет разделитель ;", () => {
    const r = parseCsv("name;price\nFigma;15");
    expect(r.delimiter).toBe(";");
    expect(r.records[0]).toEqual({ name: "Figma", price: "15" });
  });

  it("обрабатывает кавычки и запятые внутри поля", () => {
    const r = parseCsv('name,note\n"Acme, Inc.","a ""quoted"" note"');
    expect(r.records[0]).toEqual({
      name: "Acme, Inc.",
      note: 'a "quoted" note',
    });
  });

  it("снимает BOM и игнорирует пустые строки", () => {
    const r = parseCsv("﻿name\nFigma\n\nSlack\n");
    expect(r.records.map((x) => x.name)).toEqual(["Figma", "Slack"]);
  });
});

describe("partitionUnique (дедупликация §7)", () => {
  const items = [
    { email: "a@x.com" },
    { email: "B@x.com" },
    { email: "a@x.com" }, // дубль в файле
    { email: "c@x.com" },
  ];

  it("дубль внутри файла (регистронезависимо)", () => {
    const r = partitionUnique(items, (i) => i.email);
    expect(r.unique.map((i) => i.email)).toEqual([
      "a@x.com",
      "B@x.com",
      "c@x.com",
    ]);
    expect(r.duplicates).toHaveLength(1);
    expect(r.duplicates[0]!.reason).toBe("in-file");
  });

  it("дубль с существующими в БД", () => {
    const r = partitionUnique(items, (i) => i.email, ["c@x.com"]);
    expect(r.unique.map((i) => i.email)).toEqual(["a@x.com", "B@x.com"]);
    const reasons = r.duplicates.map((d) => d.reason).sort();
    expect(reasons).toEqual(["existing", "in-file"]);
  });
});
