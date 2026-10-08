# Known Issues

Deliberately deferred items + suppression records. Entries pair with `.slop.toml` waivers per `arch/security.md` 9.7.2. Stack Health Ledger below per `arch/ops.md` 24.10.

## Suppressions

| ID | Path | Rule | Rationale | Revisit |
|---|---|---|---|---|
| `editor-controller-wmc-2026-07-04` | `src/frontend/editor/editor-controller.ts` | `structural.class.complexity` | AutosaveScheduler extracted per original waiver condition (`src/frontend/editor/autosave-scheduler.ts`, WMC 57->52); REQ-018 rename-follow + clean-delete handling raises inherent state-machine branching to WMC 60 (61 at 2026-10-08 re-review, condition holds); behavior fully covered by `tests/unit/editor-controller.spec.ts` (22 specs) | 2026-12-08 or if WMC exceeds 70 (then extract event-classification module) |
| `gitleaks-notekey-fixtures-2026-07-04` | `.gitleaks.toml` allowlist regex | `generic-api-key` | Test fixtures carry literal `noteKey`/`oldKey` values (base64url of a relative path, e.g. `cmVuYW1lZC5tZA` = `renamed.md`) in object form and JSX prop form; line-scoped allowlist keeps real secret shapes detectable | Remove if noteKey fixtures move to computed helpers |
| `note-mutations-wmc-2026-07-05` | `src/backend/filesystem/note-mutations.ts` | `structural.class.complexity` | Round-2 restore + recycle-bin delete join create/move/archive; every method shares the lexically-ordered path-lock map (MasterPrompt 2.5) - splitting the archive family would need a shared lock coordinator for less cohesion; WMC 46 covered by the mutation unit suite (2026-10-08 re-review: unchanged, condition holds) | 2026-12-08 or if WMC exceeds 55 (then extract shared lock coordinator + archive service) |
| `braces-no-fix-2026-10-08` | `scripts/audit-allowlist.json` + `.trivyignore` `CVE-2026-93687` (`braces` via `trash` -> `globby` -> `fast-glob` -> `micromatch`) | npm audit `GHSA-vfj7-8cjw-p6xm` / Trivy `CVE-2026-93687` (high) | No patched `braces` release exists (`<=3.0.3` = latest). Unreachable: `src/backend/filesystem/note-mutations.ts` calls `trash(path, { glob: false })`, so globby/braces never run; `scripts/check-audit.mjs` fails on any other high/critical advisory | 2026-12-08 (allowlist expiry) or first `braces` fix / `trash` release dropping globby |

## Stack Health Ledger

Per `arch/ops.md` 24.10. Read before any maintenance or feature work; update at each quarterly currency review, any EOL/relicense discovery, and each migration close. EOL dates verified 2026-10 against the official nodejs/Release `schedule.json`; versions from `npm outdated` / `npm view` on 2026-10-08.

| Component | In use | Status | Default now | Migrated? | Revisit |
|---|---|---|---|---|---|
| Node.js runtime | 22.22.2 (`engines` >=22.12.0, ADR-006) | ok - Maintenance LTS since 2025-10-21, EOL 2027-04-30 | 24 (Active LTS until 2026-10-20); 26 Active LTS from 2026-10-28 | no - on 22 | migrate-by 2027-01-31 via `workflow/framework-upgrade.md` (EOL-isolated session) |
| Fastify + @fastify/static | 5.12.5 + 10.1.5 | ok - current majors | 5 | n/a | quarterly review 2027-01 |
| React + Vite | 19.3.0 + 8.3.2 | ok - current majors | 19 + 8 | n/a | quarterly review 2027-01 |
| Markdown + sanitize (marked, sanitize-html) | 18.0.14 + 2.18.0 | ok - current majors | 18 + 2 | n/a | quarterly review 2027-01 |
| TypeScript | 6.0.3 | 1 major behind (7.0.2) | 7 | no - on 6 | dedicated upgrade session; quarterly review 2027-01 |
| vitest + @vitest/coverage-v8 (dev) | 4.1.11 | 1 major behind (5.0.3) | 5 | no - on 4 | dedicated upgrade session (npm 10.9.7 arborist crashed on the 4.1.11 peer set; Dependabot resolved it) |
| jsdom (dev) | 29.1.1 | 1 major behind (30.1.2) | 30 | no - on 29 | bundle with the vitest upgrade |
| braces (via trash -> globby) | 3.0.3 | unpatched advisory GHSA-vfj7-8cjw-p6xm, unreachable (`glob: false`), allowlisted | n/a - no fixed release | n/a | 2026-12-08 allowlist expiry (`braces-no-fix-2026-10-08`) |

## Deferred Edge Cases

| Area | Behavior deferred | Rationale | Revisit |
|---|---|---|---|
| CI perf tripwire (`METRIC-002/003`) | `tests/integration/perf-benchmark.spec.ts` CI ceiling = 4x local budget (400ms p95 / 8s warm startup); local runs keep strict 100ms / 2s and stay the evidence source | 2026-10-08: identical code measured p95 ~57ms / startup ~1000ms locally (with and without coverage) vs p95 224-278ms / startup up to 4247ms on `ubuntu-latest`; 2x ceiling failed on runner speed, not regression | Runner speed shifts again, or any CI value within 20% of the 4x ceiling |
| Rename correlation split across watch batches (`REQ-018` edge) | Unlink and add landing in different 100ms coalesce windows surface as removed+added, not `note.renamed`; a clean open editor then parks as source-missing instead of following | Pairing is per-batch by design; cross-batch correlation needs a held-back removal buffer with timeout. Recovery path (save-as-new / close) loses no data | Wave 8 packaged-build pass, or first user report |

Resolved: waiver sweep 2026-10-08 - slop 1.0.0 run with every waiver stripped reports only the two `structural.class.complexity` violations (kept above); the 25 expired `hotspots`/`structural.hotspots`/`structural.packages` waivers no longer fire and were removed from `.slop.toml` with their rows here. New hotspot flags get a fresh waiver + row when they appear.
Resolved: Dev-only advisory `GHSA-82fw-gwwq-j7x9` (`@vitest/mocker`) - vitest 4.1.11 landed via Dependabot #57 once Dependabot targeted dev (PR #60); full `npm audit` reports only the reviewed braces chain (2026-10-08).
Resolved: `trivy-vuln-db-offline-2026-07-06` - dev machine firewall unblocked OCI registries; Trivy 0.72.0 vuln DB downloaded (dataset 2026-07-10), `trivy fs --scanners vuln` = 0 vulnerabilities on `package-lock.json` (prod deps). Local scan stack fully operational (2026-07-10).
Resolved: `api-suite-growth-2026-07-03` - `tests/api/app.spec.ts` split into `boundary.spec.ts` + `system-routes.spec.ts` (Wave 2, 2026-07-03); waiver removed.
Resolved: External delete while editor clean (`REQ-018` edge) - clean open note removed outside the app now parks as source-missing with save-as-new / close (Wave 6, 2026-07-04); app-originated removals (operation-tagged) stay silent, archive flow owns navigation.
Resolved: External rename while editor clean (`REQ-018` acceptance PARTIAL) - watch pipeline pairs unlink+add per batch (size + mtime match) and emits `note.renamed {oldKey,noteKey,version}`; clean open editor follows the new key and the route updates silently; dirty drafts park as source-missing (Wave 6, 2026-07-04).
Resolved: Archive while draft dirty (`WF-009` x `REQ-017`) - the archive dialog now flushes an open dirty draft BEFORE the move (strictly sequential, no write/move race); an unsettleable draft aborts the archive with a recoverable error (Wave 7, 2026-07-04).
Resolved: `launch-page-2026-07-03` - LaunchPage no longer in the hotspot rolling window after the Wave 2 frontend pass; kept as dev/pre-bootstrap fallback per locked decision (empty workspace shows the dashboard EmptyState instead of a LaunchPage rework); waiver removed (2026-07-03).
