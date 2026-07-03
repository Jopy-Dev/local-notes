# Implementation_Plan -- Local-Notes

| Field | Value |
|---|---|
| Status | APPROVED |
| Sources | `PRD.md`, `MasterPrompt.md`, `Design_System.md` v1.3 |
| Output siblings | `ARCHITECTURE.md`, `CHANGELOG.md` |
| Workflow profile | standard |
| Stack | ADR-001 deviation: React 19 + Vite 8 SPA, Fastify 5, filesystem, no DB/auth/Sentry/Coolify |

Rules:

- Step 14 build source. `ARCHITECTURE.md` = system map. `CHANGELOG.md` = user log. Audiences never merge.
- Every row traces to `PRD.md` / `MasterPrompt.md` section. No speculative modules.
- One wave = one bounded unit = one PR; CI green before next.
- Committed test contract `tests/e2e/route-manifest.ts`; transient evidence `.qa/` (gitignored).

## 1. Build Order / Waves

| Wave | Bounded unit | Source IDs | Build owner | Exit criteria |
|---|---|---|---|---|
| 0 | Vertical slice: shared contracts + Fastify core (capability hook, headers, error taxonomy, `/health`, `/bootstrap`) + CLI skeleton + AppRouter + launch page on real bootstrap | `REQ-001` partial, `REQ-027` partial, `SCREEN-005` | `src/shared`, `src/backend/app|server|security`, `src/cli`, `src/frontend/app` | capability suite green; `/health` + `/bootstrap` integration tests; SPA loads via Fastify static; eslint gate wired |
| 1 | Filesystem foundations: `WorkspacePathGuard`, `TextFileCodec`, `AtomicFileWriter`, `WorkspaceLock`, `ConfigV1` + migrations, logging/rotation | `REQ-002/003/021(schema)/023/025/032`, `SCREEN-004` | `src/backend/filesystem|config|logging` | traversal/symlink/fault-injection/lock/migration/rotation unit+integration suites green (test-first, ADR-003 surface) |
| 2 | Discovery + watcher + metadata cache + notes/folders APIs + SSE + dashboard real data | `REQ-005/006/007/008/024`, `WF-001/004`, `SCREEN-001` | `src/backend/routes|watcher`, `NoteRepository`, frontend dashboard | 10k-note fixture lists/sorts; external-change E2E <2s; card view + skeleton + empty states screenshot evidence |
| 3 | Search worker + Orama + search/rebuild APIs + recovery screen | `REQ-009/010`, `WF-002/011`, `SCREEN-007` | `src/backend/search`, frontend search + recovery | ranking/batch/snippet/budget suites; `METRIC-003` bench harness runs; degraded->rebuild E2E |
| 4 | Create/move/archive routes + dialogs wired | `REQ-011/012/013`, `WF-003/008/009` | routes + `MoveNotePanel`, `ArchiveDialog` | collision/validation API suites; move panel + archive collision screenshot evidence (ADR-004 debt) |
| 5 | Note open/read + plain/source editing (CodeMirror) + autosave + conflict + oversized/encoding states | `REQ-014(read)/016/017/018/019`, `WF-005/006/007`, `SCREEN-002/006` | routes content GET/PUT, `src/frontend/editor` CodeMirror, editor store | autosave/conflict/oversized E2E (test-first); read-only banners evidence; Focus Mode `.txt` scope fix lands here (ADR-005 finding) |
| 6 | Markdown pipeline: TipTap visual editor + compatibility service + render/sanitize + preview + copy actions + `<copy>` mark + find-in-note | `REQ-014(render)/015/020/028/035/036`, `WF-013` | `src/frontend/editor` TipTap, `src/backend/routes` render/assets | XSS corpus green (test-first); round-trip corpus; FindInNoteBar + copy-affordance evidence; TipTap/Orama compile-check gate before build (`MasterPrompt.md` §10) |
| 7 | Settings screen + theme + pane resize/collapse persistence | `REQ-021/022/034`, `WF-010/012`, `SCREEN-003` | settings route + form, `<PaneDivider>`, workspace UI store | settings rollback E2E; PaneDivider keyboard resize evidence; persistence across restart |
| 8 | Hardening + packaging: rate limits, offline guard, a11y sweep, perf bench, npm pack acceptance, publish workflow | `REQ-026/029/030/031/033`, `METRIC-001..006` | CLI package, `tests/performance|e2e` | network-disabled E2E; 10k perf budgets met; axe suite; `npm pack` isolated-prefix launch test; lifecycle-script allowlist CI gate |

## 2. Wave Start Packet

Packet assembled at each wave start per `workflow/implementation.md`; incomplete packet blocks wave. Standing fields:

| Field | Value |
|---|---|
| Roles | Local Operator only (PRD §3); auth-denied state = capability-missing 401 surface |
| Primitive source | `src/frontend/components/ui/*` LOCKED; extensions via Primitive Extension Protocol |
| States | default/loading/empty/error/success/capability-denied per Route-State Matrix §6 |
| Evidence | `.qa/parity-audit/wave-0N/` screenshots + console-clean note |
| Full-load at wave start | `PRD.md` + `MasterPrompt.md` + `Design_System.md` to EOF |

## 3. Route / API Map

Canonical table: `MasterPrompt.md` §5.2 (14 endpoints + SSE §5.3). Plan deltas only:

| Concern | Rule |
|---|---|
| Auth column | every route = capability hook pre-parse (ADR-003); no role guards |
| Rate limit | family table `MasterPrompt.md` §5.4 (reads 600/min, search 300, render 300, mutations 120, rebuild 2/5min) |
| Audit | none by design (`REQ-033`) |
| Idempotency | mutations carry `X-Operation-ID`; content PUT carries `If-Match` version |
| Schemas | Zod in `src/shared/schemas/*` co-located per route family; frontend imports types only |

## 4. Data / Contracts Plan (replaces Prisma schema — ADR-001)

| Contract | Purpose | Source | ADR? |
|---|---|---|---|
| `NoteMetadata`, `NoteDocument` | list/read DTOs, versionToken concurrency | `MasterPrompt.md` §2.3 | no |
| `ConfigV1` + migration registry | settings persistence | §2.7 | no |
| Lock JSON | single-instance ownership | §2.6 | no |
| Cache v1 files (metadata, search-index) | disposable acceleration | §2.8 | no |
| API success/error envelope + error codes | uniform REST contract | §5.1, §7.3 | no |
| SSE event union | live workspace updates | §5.3 | no |
| Worker message union | search thread protocol | §4.3 | no |

## 5. Component / Screen Build Map

| Source ID | Route/component | Data source | Primitive source | Wave |
|---|---|---|---|---|
| `SCREEN-001` `WF-001/002/003/004/008/009` | `/` `DashboardPage` | notes/folders/search APIs + SSE | locked ui/* + `NotesVirtualList`(+virtual) | 2-4 |
| `SCREEN-002` `WF-005/006/013` | `/notes/:noteKey` `NoteWorkspacePage` | note/render/assets APIs + SSE | ui/* + `src/frontend/editor/*` | 5-6 |
| `SCREEN-003` `WF-010/012` | `/settings` `SettingsPage` | settings API | ui/* (SettingsForm exists) | 7 |
| `SCREEN-004` | CLI `WorkspaceLockPresenter` | lock service | CLI copy standard | 1 |
| `SCREEN-005` | CLI/browser `StartupErrorPresenter` | bootstrap errors | ui/* ErrorState + CLI copy | 0-1 |
| `SCREEN-006` `WF-007` | conflict surface `ConflictPanel` | editor store + note API | ui/ConflictPanel (exists) | 5 |
| `SCREEN-007` `WF-011` | `/recovery/search` `SearchRecoveryPage` | search status/rebuild + SSE | ui/* + SearchRecoveryPanel | 3 |

## 6. Route-State Matrix

States per screen; `Auth-denied` = capability missing/stale -> secure-relaunch instruction (`REQ-001`).

| Source ID | Default | Loading | Empty | Error | Success | Capability-denied | Evidence |
|---|---|---|---|---|---|---|---|
| `SCREEN-001` | populated list | skeleton | create-action empty state | partial-error banner | list current | relaunch surface | `.qa/parity-audit/wave-02/` |
| `SCREEN-002` | read mode | note skeleton | n/a (404 -> missing state) | missing/unreadable/oversized distinct | editable + saved | relaunch surface | wave-05/06 |
| `SCREEN-003` | form ready | form loading | n/a | invalid field + persistence error | applied toast | relaunch surface | wave-07 |
| `SCREEN-004` | lock message | n/a | n/a | stale-recovery failure | exit 2 | n/a (terminal) | wave-01 CLI transcript |
| `SCREEN-005` | error detail | n/a | n/a | config/port/unexpected variants | n/a | n/a | wave-00/01 |
| `SCREEN-006` | conflict banner | resolving | n/a | resolution error | resolved toast | relaunch surface | wave-01 evidence exists (banner); full flow wave-05 |
| `SCREEN-007` | degraded status | rebuilding progress | n/a | rebuild failed | ready | relaunch surface | wave-03 |

### 6.1 Step 15 Route Manifest

| Contract | Path | Status | Owner |
|---|---|---|---|
| Every `SCREEN-###` -> route, states, criticality, evidence method; criticalJourneys = launch, edit/autosave, conflict, search, archive | `tests/e2e/route-manifest.ts` | Open (Wave 0 seeds, Wave 8 completes) | `workflow/testing-validation.md` §15.2 |

## 7. Traceability Closure

Canonical matrix: `MasterPrompt.md` §9.1-§9.4 (every `REQ/SCREEN/WF/METRIC` -> owner + test name). Plan tracks closure status per wave; wave DoD requires touched IDs closed. Current status: all Open except `SCREEN-001/002` shell visuals (partial, Step 11 parity evidence).

## 8. Env / Dependency Inventory

Env surface: NONE by design (ADR-001/003). No `.env`, no `.env.example`, no secrets. `NODE_ENV` = only runtime discriminator (dev mocks, prod static serving). `check-env-parity` gate = N/A.

Dependencies verified live 2026-07-03 (npm registry); exact pins, no `^`:

| Package | Version | Scope | Admission (arch/core.md §1.1) |
|---|---|---|---|
| react / react-dom | 19.2.7 | runtime | installed Step 11 |
| zustand | 5.0.14 | runtime | MasterPrompt §1.3 frontend state |
| fastify | 5.9.0 | runtime | local server core |
| @fastify/static | 9.1.3 | runtime | packaged SPA serving |
| zod | 4.4.3 | runtime | all API validation |
| pino / pino-pretty | 10.3.1 / 13.1.3 | runtime / dev | local diagnostics `REQ-025` |
| @tiptap/core,react,starter-kit,markdown,extension-underline,extension-table,extension-task-list,extension-task-item,extension-link,pm | 3.27.1 | runtime | visual Markdown editor `REQ-015`; v3 markdown now first-party |
| codemirror | 6.0.2 | runtime | source/plain editor `REQ-016` |
| @codemirror/lang-markdown | 6.5.0 | runtime | source highlighting |
| @codemirror/search | 6.7.1 | runtime | find-in-note `REQ-035` |
| @orama/orama | 3.1.18 | runtime | search index `REQ-009`; raw save/load, no persistence plugin |
| chokidar | 5.0.0 | runtime | watcher `REQ-006` |
| @tanstack/react-virtual | 3.14.5 | runtime | 10k-note list `REQ-031` |
| open | 11.0.0 | runtime | browser launch `REQ-001` |
| marked | 18.0.5 | runtime | server render pipeline |
| sanitize-html / @types | 2.17.5 / 2.16.1 | runtime / dev | content safety `REQ-028` |
| vite / @vitejs/plugin-react | 8.1.3 / 6.0.3 | dev | installed Step 11 |
| tailwindcss / @tailwindcss/vite | 4.3.2 | dev | installed Step 11 |
| typescript | 6.0.3 | dev | installed Step 11 |
| vitest | 4.1.9 | dev | installed Step 11 |
| @testing-library/react / user-event | 16.3.2 / 14.6.1 | dev | component suites |
| jsdom | 29.1.1 | dev | vitest DOM env |
| @playwright/test | 1.61.1 | dev | E2E + a11y |
| eslint + typescript-eslint + eslint-plugin-tailwindcss | pin at Wave 0 install | dev | anti-drift gate (raw-color ban) |
| axe-playwright (or @axe-core/playwright) | pin at Wave 8 | dev | `METRIC-005` |
| size-limit | pin at Wave 8 | dev | client bundle budget |

Install policy: deps land in the wave that first consumes them; `engines.node >=22.12.0` per ADR-006. Compile-check gate: TipTap markdown round-trip + Orama save/load spike BEFORE Wave 6 editor build (`MasterPrompt.md` §10).

## 9. Observability / Metrics Map (adapted: no Sentry — ADR-001)

| Source ID | Event | Emission point | Payload | Destination |
|---|---|---|---|---|
| `METRIC-001` | `metric.launch.ready` | package E2E harness | duration, OS, node major, result | local JUnit/JSON |
| `METRIC-002` | `metric.startup.interactive` | frontend bootstrap mark | duration, fixture, result | perf report |
| `METRIC-003` | `metric.search.response` | search bench | duration, query class, count | perf report |
| `METRIC-004` | `metric.filesystem.integrity` | integrity suite | case, result, hashes | JUnit/JSON |
| `METRIC-005` | `metric.accessibility.core` | axe/keyboard suite | screen, viewport, violations | a11y report |
| `METRIC-006` | `metric.offline.workflow` | network-disabled E2E | workflow, violations, result | JUnit/JSON |
| logs | pino ops | backend services | ts, level, requestId/opId, op, sanitized rel path, code, duration — NEVER content/query/body (`REQ-025`) | `~/.local-notes/logs/` |

All destinations local test artifacts under `.qa/`; zero runtime analytics (`REQ-026`).

## 10. Verification Scripts / Gates

| Gate | Command | Required result | Wave wired |
|---|---|---|---|
| Typecheck | `npm run typecheck` | pass | live |
| Unit/component | `npm test` | pass + coverage: security-critical 100%, overall >=70% (Step 15) | live / thresholds Wave 1 |
| Lint | `npm run lint` (eslint + tailwind strict, raw-color ban) | pass | Wave 0 |
| Slop | `slop lint --root .` post-edit + post-commit (`PYTHONIOENCODING=utf-8` on Windows) | PASS | live |
| Changed-path gitleaks | `gitleaks detect --no-git --source <paths>` | no leaks | live |
| E2E | `npm run test:e2e` (Playwright, packaged server) | pass | Wave 2+ |
| A11y | `npm run test:a11y` (axe + keyboard) | no critical/serious | Wave 8 (spot checks earlier) |
| Local pre-handoff | `npm run verify:local` = typecheck+lint+unit+e2e-smoke+slop+gitleaks | pass | Wave 0 script, full at Step 15 |
| Perf bench | `npm run bench:perf` (10k fixture) | METRIC-002/003 budgets | Wave 8 |
| Package acceptance | `npm run test:package` (`npm pack` -> isolated prefix -> offline launch) | pass | Wave 8 |
| Predeploy scan | `npm run scan:predeploy` (semgrep -> trivy fs -> gitleaks) local-only at publish gate | pass | Wave 8 / Step 17-equivalent |
| Lifecycle-script allowlist | CI check: lockfile deps with install scripts require allowlist entry | pass | Wave 8 (`MasterPrompt.md` §1.5) |

Baseline-checklist N/A rows (deviation source ADR-001): Prisma/migration drift, Sentry DSN, Coolify staging, VPS backups/B2, env-parity, NextAuth device trust, Master Developer Dashboard + audit log (`REQ-033`: no behavioral audit; no admin surface exists), Docker/standalone output, hidden-URL bundle guard (no hidden routes; offline guard covers outbound requests instead).

## 11. QA Evidence Index

| Evidence | Path | Gate | Status |
|---|---|---|---|
| Design parity wave 0 (prototypes) | `.qa/parity-audit/wave-00/` | Step 8 | Done |
| Step 11 port parity | `.qa/parity-audit/wave-01/` | Step 11 | Done |
| Per-wave screen evidence | `.qa/parity-audit/wave-0N/` | Step 14 DoD | Open |
| Step 15 manifest | `.qa/step-15-local-validation/evidence-manifest.json` | Step 15 | Open |
| User acceptance checklist | `.qa/step-16-user-validation/acceptance-checklist-v1.md` | Step 16 | Open |
| Predeploy scan output | `.qa/step-17-predeploy-scan/` | publish gate | Open |

## 12. Wave Definition of Done

Per `workflow/implementation.md` Wave DoD verbatim: traceability closed, tests green (test-first on ADR-003 security surface), slop + gitleaks green, console clean, visual/a11y checks at `1024x640`+`1280x720`, `CHANGELOG.md` `[Unreleased]` entry, STRIDE row re-run when new endpoint lands, `ARCHITECTURE.md` updated same PR on structural change.

## 13. Open Decisions / Blockers

| Type | Item | Source | Proposal | Blocking? |
|---|---|---|---|---|
| design | ADR-004 visual-proof debt list | ADR-004 | capture per owning wave (map in ADR-004 Consequences) | no |
| docs | `REQ-018` clean-rename follow (`note.renamed` in event union, pipeline never emits) | Wave 5 review | implement rename correlation + route/key follow in Wave 6 editor pass; `KNOWN_ISSUES.md` Deferred Edge Cases | no |
| infra | repo public + dependency-review re-add at first publish | Round 8 CI lesson | flip visibility at Step 17-equivalent, restore CI step | no |
