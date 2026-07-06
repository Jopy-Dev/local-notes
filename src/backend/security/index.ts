import { randomBytes } from "node:crypto";

export { generateCapability, verifyCapability } from "./capability.js";

// Per-response CSP nonce (MasterPrompt.md 7.1).
export function generateNonce(): string {
  return randomBytes(16).toString("base64url");
}
