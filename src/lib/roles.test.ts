import { describe, it, expect } from "vitest";
import { hasRole, ROLE_RANK } from "@/lib/roles";

describe("hasRole", () => {
  it("admin проходит любую проверку", () => {
    expect(hasRole("admin", "viewer")).toBe(true);
    expect(hasRole("admin", "manager")).toBe(true);
    expect(hasRole("admin", "admin")).toBe(true);
  });

  it("manager проходит manager и viewer, но не admin", () => {
    expect(hasRole("manager", "viewer")).toBe(true);
    expect(hasRole("manager", "manager")).toBe(true);
    expect(hasRole("manager", "admin")).toBe(false);
  });

  it("viewer проходит только viewer", () => {
    expect(hasRole("viewer", "viewer")).toBe(true);
    expect(hasRole("viewer", "manager")).toBe(false);
    expect(hasRole("viewer", "admin")).toBe(false);
  });

  it("иерархия строго возрастает", () => {
    expect(ROLE_RANK.viewer).toBeLessThan(ROLE_RANK.manager);
    expect(ROLE_RANK.manager).toBeLessThan(ROLE_RANK.admin);
  });
});
