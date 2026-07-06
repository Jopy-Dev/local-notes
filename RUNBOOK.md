# Local-Notes Runbook

Operator procedures. Structure map: `ARCHITECTURE.md`. Build order: `Implementation_Plan.md`.

## 1. Run Local (Development)

| Task | Command | Notes |
|---|---|---|
| Frontend dev server | `npm run dev` | Vite on `http://localhost:5173`; `/` launch screen, `/shell` workspace parity screen (temporary path switch until AppRouter) |
| API proxy | automatic | `/api/v1` + `/api/v1/events` proxy to `127.0.0.1:8989`; backend lands Wave 0-1 |
| Production-shape run | `npm run build` then packaged CLI (Wave 8) | Fastify serves `dist/client` at `http://127.0.0.1:8989` |

Requirements: Node >=22.12 (ADR-006), npm 10+. No env vars, no services, no Docker.

## 2. Verify / Test

| Gate | Command |
|---|---|
| Typecheck | `npm run typecheck` |
| Unit/component | `npm test` |
| Build | `npm run build` |
| Slop lint | `slop lint --root .` — Windows: set `PYTHONIOENCODING=utf-8` first |
| Secrets scan | `gitleaks detect --no-banner --redact --no-git --source src` |
| Full local gate | `npm run verify:local` (Wave 0+) |

CI mirror: `.github/workflows/ci.yml` `verify` job on every PR to `main`/`dev`.

## 3. Release (npm publish)

Wave 8 / Step 17-equivalent; contract `MasterPrompt.md` §1.5:

1. Recheck npm name availability
2. Flip repo public; restore dependency-review CI step (Round 8 note)
3. Configure npm trusted publishing (GitHub Actions OIDC + provenance) — no long-lived token
4. Protected release tag -> publish workflow: clean lockfile build, `npm pack --dry-run`, contents allowlist, tests, audits, scans -> `npm publish`
5. Remove `"private": true` in the release PR only

Rollback: `npm deprecate` bad version + publish patched version; never unpublish (breaks installs).

## 4. Incident Triage

1. Reproduce; note exit code (CLI: 0 clean, 2 lock, 3 port, 4 config/workspace, 1 unexpected)
2. Read `~/.local-notes/logs/` (pino JSON; rotation 10 MiB/file, 30d/100 MiB retention)
3. Map symptom -> `ARCHITECTURE.md` §7 Bug Triage Map row -> entry-point files + tests
4. Fix via `diagnose` discipline: repro -> failing test -> root cause -> regression test

## 5. Recovery Procedures

| Failure | Procedure | Data risk |
|---|---|---|
| Stale workspace lock | app auto-recovers dead-PID lock; foreign/unreadable lock -> verify no other instance, delete `~/.local-notes/.lock` | none — lock is metadata |
| Corrupt search index | Search Recovery screen (`/recovery/search`) -> Rebuild; or delete `~/.local-notes/cache/search-index-v1.json` and restart | none — index disposable |
| Corrupt metadata cache | delete `~/.local-notes/cache/metadata-v1.json`; startup rebuilds from filesystem | none — cache disposable |
| Invalid config | startup blocks and names file; fix or delete `~/.local-notes/config.json` (defaults regenerate) | settings only |
| Port 8989 blocked | free the reported blocking process; fixed port by contract (`REQ-001`) | none |
| Notes themselves | plain `.md`/`.txt` under `~/.local-notes/save-data/` — user-owned, readable by any editor; no product backup in MVP (disclosed residual risk, Step 15) | user responsibility |
