/*
 * Production response headers (MasterPrompt.md 7.1). Per-response nonce feeds
 * style-src; no HSTS because transport is loopback HTTP by design (ADR-003).
 */
export function buildSecurityHeaders(nonce: string): Record<string, string> {
  return {
    "content-security-policy":
      "default-src 'self'; script-src 'self'; " +
      `style-src 'self' 'nonce-${nonce}'; ` +
      "img-src 'self' blob:; connect-src 'self'; font-src 'self'; " +
      "object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "no-referrer",
    "permissions-policy": "camera=(), microphone=(), geolocation=()",
  };
}
