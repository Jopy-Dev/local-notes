import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/*
 * Per-launch access capability (ADR-003, MasterPrompt.md 3, 4.1).
 * 256-bit random value; exists only in process memory and browser
 * sessionStorage. Never logged, persisted, or echoed in responses.
 */
export function generateCapability(): string {
  return randomBytes(32).toString("base64url");
}

/*
 * Timing-safe verification. Both inputs are hashed to fixed length first so
 * length differences neither throw nor leak timing (per arch/security.md
 * timing-safe comparison requirement referenced by REQ-027 tests).
 */
export function verifyCapability(token: string | undefined, capability: string): boolean {
  if (typeof token !== "string" || token.length === 0) return false;
  const tokenDigest = createHash("sha256").update(token).digest();
  const capabilityDigest = createHash("sha256").update(capability).digest();
  return timingSafeEqual(tokenDigest, capabilityDigest) && token.length === capability.length;
}
