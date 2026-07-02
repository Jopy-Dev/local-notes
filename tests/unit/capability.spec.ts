import { describe, expect, it } from "vitest";
import { generateCapability, verifyCapability } from "../../src/backend/security/capability.js";

// ADR-003: per-launch 256-bit capability, base64url, timing-safe verification.
describe("generateCapability", () => {
  it("returns 43-char base64url string (32 bytes, no padding)", () => {
    const capability = generateCapability();
    expect(capability).toHaveLength(43);
    expect(capability).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("returns a different value on every launch", () => {
    const seen = new Set(Array.from({ length: 50 }, () => generateCapability()));
    expect(seen.size).toBe(50);
  });
});

describe("verifyCapability", () => {
  const capability = generateCapability();

  it("accepts the exact capability", () => {
    expect(verifyCapability(capability, capability)).toBe(true);
  });

  it("rejects a wrong token of equal length", () => {
    const wrong = generateCapability();
    expect(verifyCapability(wrong, capability)).toBe(false);
  });

  it("rejects empty, undefined, and length-mismatched tokens without throwing", () => {
    expect(verifyCapability("", capability)).toBe(false);
    expect(verifyCapability(undefined, capability)).toBe(false);
    expect(verifyCapability(capability.slice(0, 10), capability)).toBe(false);
    expect(verifyCapability(`${capability}x`, capability)).toBe(false);
  });
});
