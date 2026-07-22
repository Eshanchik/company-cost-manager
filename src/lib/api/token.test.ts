import { describe, it, expect } from "vitest";
import { generateToken, hashToken } from "@/lib/api/token";

describe("token", () => {
  it("hashToken детерминирован и sha256 (64 hex)", () => {
    const h = hashToken("st_abc");
    expect(h).toBe(hashToken("st_abc"));
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it("generateToken: префикс st_, длина префикса 11, хэш соответствует", () => {
    const { token, prefix, hash } = generateToken();
    expect(token.startsWith("st_")).toBe(true);
    expect(prefix).toBe(token.slice(0, 11));
    expect(hash).toBe(hashToken(token));
  });

  it("токены уникальны", () => {
    expect(generateToken().token).not.toBe(generateToken().token);
  });
});
