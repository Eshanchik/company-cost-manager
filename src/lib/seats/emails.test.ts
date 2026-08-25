import { describe, it, expect } from "vitest";
import { parseEmailList } from "@/lib/seats/emails";

describe("parseEmailList (массовое добавление мест)", () => {
  it("разбирает список по строкам, запятым и точкам с запятой", () => {
    const r = parseEmailList("a@x.com\nb@x.com, c@x.com; d@x.com");
    expect(r.emails).toEqual(["a@x.com", "b@x.com", "c@x.com", "d@x.com"]);
    expect(r.invalid).toEqual([]);
  });

  it("приводит к нижнему регистру и схлопывает дубли", () => {
    const r = parseEmailList("A@x.com\na@x.com\nB@X.com");
    expect(r.emails).toEqual(["a@x.com", "b@x.com"]);
  });

  it("отделяет некорректные адреса", () => {
    const r = parseEmailList("ok@x.com\nне-email\nbroken@\n@nope.com");
    expect(r.emails).toEqual(["ok@x.com"]);
    expect(r.invalid).toEqual(["не-email", "broken@", "@nope.com"]);
  });

  it("пустой ввод → пустые списки", () => {
    expect(parseEmailList("   \n\n  ")).toEqual({ emails: [], invalid: [] });
  });

  it("терпит лишние пробелы и хвостовые разделители", () => {
    const r = parseEmailList("  a@x.com ,  b@x.com ,,\n");
    expect(r.emails).toEqual(["a@x.com", "b@x.com"]);
  });
});
