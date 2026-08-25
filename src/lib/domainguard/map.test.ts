import { describe, it, expect } from "vitest";
import { mapDgDomain, filterByProjects } from "@/lib/domainguard/map";
import type { DgDomain } from "@/lib/domainguard/client";

const now = new Date("2026-08-25T00:00:00.000Z");
const dg = (over: Partial<DgDomain> = {}): DgDomain => ({
  id: 253,
  project_id: 10,
  fqdn: "GT1.one",
  punycode: "gt1.one",
  tld: "one",
  expiry_date: "2027-04-08T00:00:00Z",
  auto_renew: true,
  is_active: true,
  renewal_price: "30.98",
  renewal_currency: "USD",
  created_at: "2026-07-21T18:01:57Z",
  ...over,
});

describe("mapDgDomain", () => {
  it("базовый маппинг: имя в нижнем регистре, дата продления, цена", () => {
    const m = mapDgDomain(dg(), now);
    expect(m.externalId).toBe("253");
    expect(m.name).toBe("gt1.one");
    expect(m.renewalDate?.toISOString().slice(0, 10)).toBe("2027-04-08");
    expect(m.price?.toString()).toBe("30.98");
    expect(m.currency).toBe("USD");
    expect(m.status).toBe("active");
  });

  it("цена не указана → null (не 0), чтобы не затирать ручной ввод", () => {
    expect(mapDgDomain(dg({ renewal_price: null }), now).price).toBeNull();
    expect(mapDgDomain(dg({ renewal_price: "" }), now).price).toBeNull();
  });

  it("is_active=false → архив", () => {
    expect(mapDgDomain(dg({ is_active: false }), now).status).toBe("archived");
  });

  it("auto_renew пробрасывается", () => {
    expect(mapDgDomain(dg({ auto_renew: false }), now).autoRenew).toBe(false);
  });

  it("валюта по умолчанию USD, если реестр не отдал", () => {
    expect(mapDgDomain(dg({ renewal_currency: null }), now).currency).toBe("USD");
  });

  it("следующий платёж = ближайшая годовщина продления", () => {
    const m = mapDgDomain(dg({ expiry_date: "2026-09-10T00:00:00Z" }), now);
    expect(m.nextPaymentDate?.toISOString().slice(0, 10)).toBe("2026-09-10");
  });

  it("без даты истечения — без даты продления и платежа", () => {
    const m = mapDgDomain(dg({ expiry_date: null }), now);
    expect(m.renewalDate).toBeNull();
    expect(m.nextPaymentDate).toBeNull();
  });
});

describe("filterByProjects", () => {
  const list = [dg({ id: 1, project_id: 7 }), dg({ id: 2, project_id: 6 }), dg({ id: 3, project_id: 10 })];

  it("оставляет только указанные проекты (GT1: 7,8,9,10,13)", () => {
    expect(filterByProjects(list, [7, 8, 9, 10, 13]).map((d) => d.id)).toEqual([1, 3]);
  });

  it("пустой список проектов → без фильтра", () => {
    expect(filterByProjects(list, [])).toHaveLength(3);
  });
});
