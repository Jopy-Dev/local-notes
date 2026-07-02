# ADR-003: Loopback Capability Security Model (No Auth System, In-Memory Rate Limits)

Date: 2026-07-03
Status: Accepted

## Context

Baseline mandates NextAuth v5 JWT sessions, email OTP 2FA, bcrypt, Redis-backed rate limiting (`arch/core.md` §1; `arch/auth.md`). Local-Notes has exactly one human (Local Operator) on one machine, no accounts, no network exposure (PRD §3, `REQ-026`, `REQ-027`). The threat model (Step 6 STRIDE-lite, `feedback_security_assessment.md`) is: other local processes/users hitting the loopback port, malicious note content, and path escape — not remote credential attacks.

## Decision

Authorization boundary per `MasterPrompt.md` §3 + §7.1:

- Fastify binds exactly `127.0.0.1:8989`; `trustProxy=false`; unexpected `Host` rejected before routing
- Per-launch 256-bit capability (`randomBytes(32)` base64url) delivered once via URL fragment, moved to `sessionStorage` by bootstrap script, then stripped via `history.replaceState`; server compares with timing-safe equality; every API/SSE/asset request requires `X-Local-Notes-Token`; failures return `401 LOCAL_ACCESS_REQUIRED` before body parsing
- Mutations additionally require exact `Origin: http://127.0.0.1:8989` + declared content type + Zod-valid payload
- Sliding-window in-memory rate limits per route family (`MasterPrompt.md` §5.4), map capped at 1,024 keys; cleared on restart by design
- `WorkspacePathGuard` on every filesystem operation (`MasterPrompt.md` §2.4); CSP with per-response nonce, no HSTS (loopback HTTP)

## Alternatives Rejected

- **NextAuth/password/OTP.** There is no second party to authenticate against and no server-side identity store; an account system on a single-user local app adds attack surface (stored credentials) while protecting nothing the capability does not already protect.
- **No token at all ("localhost is private").** Rejected — any local process or malicious web page attempting DNS-rebinding/CSRF against the loopback port must fail. Capability + Origin + Host checks close this class (PRD `REQ-027` acceptance).
- **Redis/Valkey-backed rate limiter.** A second process/service for a single-process offline app; in-memory buckets bound the same abuse (`REQ-029`) without infrastructure. Restart-clears-limits is acceptable because restart also rotates the capability.
- **Persisted capability (config/cookie).** Rejected — persistence widens the window in which a leaked token works; per-launch rotation keeps exposure one-session.

## Trade-offs

Losing hosted-session revocation and audit trails is acceptable: `REQ-033` explicitly excludes behavioral audit; operational evidence = filesystem timestamps + bounded local logs. Terminal fallback URL printing (browser-launch failure) exposes the capability in terminal scrollback until process exit — documented as accepted residual risk in the Step 6 assessment.

## Consequences

Security-critical test surface (Step 14 test-first per `workflow/implementation.md`): capability entropy/timing-safe comparison/stale rejection, fragment removal, storage/log leakage, Host/Origin rejection, path traversal + symlink race corpus, rate-limit bounds. XSS/sanitizer corpus covers `<u>` + `<copy>` allowlist (ADR queue: none — covered by `REQ-028`/`REQ-036` suites).
