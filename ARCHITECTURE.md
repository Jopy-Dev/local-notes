# Local-Notes Architecture

Live system map. Updated in every PR that changes structure (`arch/docs-git.md` §22.1). Build order lives in `Implementation_Plan.md`; product contract in `PRD.md`; implementation spec in `MasterPrompt.md`.

## 1. Runtime Topology

```text
npx local-notes (src/cli)
  -> config root + workspace bootstrap (~/.local-notes/)
  -> exclusive workspace lock (.lock, wx create)
  -> pino logger (local rotating files)
  -> search worker thread (Orama index)
  -> chokidar watcher (active notes root)
  -> Fastify 5 @ 127.0.0.1:8989
       serves Vite-built React SPA (dist/client)
       REST /api/v1/*  +  SSE /api/v1/events
  -> default browser via `open` with #access=<capability> fragment
```

Single Node.js process + one worker thread. No database, no network beyond loopback, no telemetry (ADR-001). Filesystem is the sole source of truth; metadata cache and search index are disposable (`MasterPrompt.md` §2.8).

## 2. Module Map

| Module | Path | Owns |
|---|---|---|
| CLI | `src/cli/` | argv, bootstrap order, exit codes 0/1/2/3/4, browser launch, shutdown sequence |
| Server core | `src/backend/app.ts`, `server.ts` | Fastify instance, plugin registration, capability hook, headers/CSP, error taxonomy |
| Routes | `src/backend/routes/` | `/api/v1` REST handlers per `MasterPrompt.md` §5.2 + SSE |
| Filesystem services | `src/backend/filesystem/` | `WorkspacePathGuard`, `TextFileCodec`, `AtomicFileWriter`, `WorkspaceLock`, `NoteRepository`, archive/move |
| Search | `src/backend/search/` | worker thread host, Orama index, message protocol, budget ledger, checkpoints |
| Watcher | `src/backend/watcher/` | chokidar pipeline, 100ms coalescing, rename correlation (unlink+add pairing → `note.renamed`), event → repository/index/SSE fanout |
| Config | `src/backend/config/` | `ConfigV1` Zod schema, defaults, migration registry, config mutex |
| Logging | `src/backend/logging/` | pino setup, rotation (10 MiB/file), retention (30d / 100 MiB) |
| Security | `src/backend/security/` | capability generation/comparison, rate-limit buckets, origin/host checks |
| Frontend app | `src/frontend/app/` | `App` + `AppRouter` (History API, routes `/`, `/notes/:noteKey`, `/settings`, `/recovery/search`) |
| Pages | `src/frontend/pages/` | route-level composition + state hooks |
| UI primitives | `src/frontend/components/ui/` | LOCKED Step 11 primitive library (Design_System.md §9) |
| Feature components | `src/frontend/components/` | shell/launch compositions built from primitives |
| Editors | `src/frontend/editor/` | CodeMirror source/plain editor, `MarkdownToolbar` + pure `markdown-commands` transforms, preview + copy mounts |
| Stores | `src/frontend/stores/` | Zustand: editor state, settings/theme state (`settingsData`), workspace UI state (`workspaceUi`: pane widths/collapse), dashboard + search state |
| Services | `src/frontend/services/` | API client (capability header), SSE reader, mock data (Step 11 only) |
| Shared | `src/shared/` | Zod request/response schemas, contracts, constants, error codes — imported by both sides |

Status: Waves 0-5 live — Fastify core + capability boundary, filesystem foundations, discovery/watcher/SSE with real dashboard data, the Orama search stack (`src/backend/search/`; `/search`, `/search/rebuild`, `/recovery/search`), note mutations (`src/backend/filesystem/note-mutations.ts` + `routes/mutations.ts`: create/move/archive with case-folded collisions; `events/operation-registry.ts` + `watcher/watch-event-pipeline.ts` give self-event suppression via operation IDs), and live editing (`src/backend/filesystem/note-content.ts` + `routes/content.ts`: `GET /notes/:key` NoteDocument + `PUT /notes/:key/content` with `If-Match` version and `X-Operation-ID`; `src/frontend/editor/editor-controller.ts` state machine owns 750ms autosave, one-in-flight save queue, REQ-017 flush-before-navigation guard with stay/discard, conflict transitions, and open-epoch staleness protection with autosave timing extracted to `editor/autosave-scheduler.ts`; `SourceEditor.tsx` is the CodeMirror 6 surface). Wave 6 adds the markdown pipeline and editor surfaces: server-side render/sanitize boundary (`routes/markdown.ts` + guarded asset endpoint), TipTap visual editing with the compatibility service, live preview, copy actions and the copyable-text affordance, find-in-note across all modes, and REQ-018 external-change identity: the watch pipeline pairs unlink+add per coalesced batch into `note.renamed` so a clean open editor follows the new key (route synced in the shell), and a clean external delete parks as source-missing immediately. Wave 8 moves the search engine onto a `node:worker_threads` thread: `search-worker.ts` (compiled entry) owns the Orama `SearchIndex` and serialization behind the fixed message union (`worker-protocol.ts`), `worker-engine.ts` hosts the thread (requestId correlation, crash detection, respawn), and `SearchService` keeps orchestration main-thread (status lifecycle, checkpoints, content reads through the path guard, budget rebalance) over a `SearchEnginePort` - crash degrades search, restarts the worker once with an automatic rebuild, repeated crash waits for the recovery-screen rebuild; a dev tree without a dist build falls back in-process with a warning. Wave 8 hardening: WF-004 sort wiring (`stores/workspace-preferences.ts` optimistic commit + `effectiveSort`), REQ-025 pino wiring (`logging/logger.ts` -> `RotatingLogDestination`, serialized writes, hourly retention), REQ-026 outbound guard (`scripts/net-guard.cjs` preloaded into the package acceptance run), REQ-031 virtualization (`ui/NotesVirtualList.tsx` renders only the visible window; two-phase Orama retrieval keeps 10k-note search p95 under budget - exact pass first, tolerance-1 rescue only on zero exact hits), and the REQ-030 axe sweep (`tests/e2e/a11y.spec.ts`, Chromium installed in CI; the TipTap surface now carries its own accessible name). Wave 7 wires settings end-to-end: `routes/settings.ts` (GET/PUT over `ConfigV1`, partial strict updates, `settings.changed` SSE), the real SCREEN-003 form on a route-driven `/settings` dialog, theme + editor appearance applied through CSS custom properties (`services/theme.ts`, `stores/settingsData.ts`), persisted sort direction, and REQ-034 pane resize/collapse (`ui/PaneDivider.tsx` + `stores/workspaceUi.ts`: 250ms debounced width commits with rollback, session-held pre-collapse widths). Archiving an open dirty note now flushes the draft before the move. User-feedback round 2 (ADR-008/009) reshapes the editing and library surfaces: the TipTap visual editor and its compatibility service are REMOVED - modes are Read/Source/Split and `SourceEditor` hosts `MarkdownToolbar` (pure `markdown-commands.ts` transforms dispatched as undoable CodeMirror edits); card view and the `dashboardView` config key are gone (list only); the `editorWidth` config key and line-length cap are gone entirely (round 2b - editor and preview always fill their pane); `<copy>` supports multi-line block regions rendered through `markdown/copy-blocks.ts` pre-pass plus click-to-copy in previews with line-aware clipboard text (`editor/copy-mounts.ts`); the sidebar library rows are live - Recent (`GET /notes?recent=true`, 7-day window) and Archive (`GET /notes?archived=true` over a second `NoteRepository` on `save-data/archive`); archived notes open read-only at `/archive/:noteKey` (`shell/ArchiveNoteView.tsx`) with restore (`NoteMutationService.restore`, same lock map + collision rules as move) and Delete to the OS recycle bin (`NoteMutationService.deleteArchived` via injectable `trash`).

## 3. Data Flow

- **Read path:** SPA → `GET /api/v1/*` (capability header) → route Zod validation → filesystem service → `WorkspacePathGuard` → disk → DTO (shared schema) → SPA store.
- **Write path:** editor draft → autosave scheduler (750ms) → `PUT /notes/:key/content` (`If-Match` version, `X-Operation-ID`) → guard + version recheck → `AtomicFileWriter` (temp + fsync + rename) → new `versionToken` → store update; watcher sees own write, suppresses via operation ID.
- **External change:** chokidar event → coalesce → repository metadata update → worker `UPSERT`/`REMOVE` → SSE event → SPA refetch/conflict flow (`WF-007`).
- **Search:** query → `GET /search` → worker `SEARCH` message → Orama + post-rank tiers → 200-result batches → SPA.
- **Config:** settings form → `PUT /settings` (partial) → config mutex → Zod merge → atomic write → `settings.changed` SSE.

## 4. Security Boundaries

| Boundary | Enforcement | Source |
|---|---|---|
| Network | bind `127.0.0.1:8989` only; Host check; `trustProxy=false`; no HSTS (loopback HTTP) | ADR-003, `MasterPrompt.md` §7.1 |
| Request identity | per-launch 256-bit capability, timing-safe compare, sessionStorage only, 401 before body parse | ADR-003 |
| Mutation | Origin equality + declared content type + Zod payload + rate-limit family | `MasterPrompt.md` §3, §5.4 |
| Filesystem | `WorkspacePathGuard` 9-step validation, symlink/junction rejection, no-follow open, handle identity check | `MasterPrompt.md` §2.4 |
| Content | server-side sanitize (`marked` + `sanitize-html`), allowlist `<u>` + `<copy>` only, guarded asset endpoint, CSP nonce, no `unsafe-eval` | `MasterPrompt.md` §4.6, §7.1-7.2 |
| Durability | `AtomicFileWriter` mutex + version recheck + temp/rename; workspace lock single instance | `MasterPrompt.md` §2.5-2.6 |
| Deletion | archived notes only; confirmation dialog; `trash` -> OS recycle bin; app never unlinks note content; active notes have no delete path | ADR-009, `MasterPrompt.md` §4.13 |

## 5. Integration Points

None external at runtime (offline contract, `REQ-026`). Build/CI integrations: GitHub Actions (`verify` job + `release.yml` tag workflow attaching the `npm pack` tarball to a GitHub Release per ADR-007 — no npm publish, repo private), Dependabot.

## 6. Role Boundaries

Single human role Local Operator + system actor Local Process (PRD §3). No RBAC, no IDOR surface between users — IDOR-equivalent risk is path escape, owned by `WorkspacePathGuard`.

## 7. Bug Triage Map

| Symptom | Likely Area | Docs To Check | Source Entry Points | Tests/Checks | Signals |
|---|---|---|---|---|---|
| Launch fails / no browser / port error | CLI bootstrap, port bind | `REQ-001`, `MasterPrompt.md` §4.1 | `src/cli/index.ts`, `launch.ts` | `REQ-001.launch.e2e`, exit-code table | exit codes 1-4, terminal copy, pino `startup` op |
| `Workspace already in use.` wrongly / lock stuck | WorkspaceLock | `REQ-003`, `MasterPrompt.md` §2.6 | `src/backend/filesystem/` lock service | `REQ-003.lock.e2e`, stale-recovery unit | lock JSON pid/host, pino `lock` op |
| Notes missing / duplicated on dashboard | discovery scan, watcher coalesce, metadata cache | `REQ-005/006/024`, §4.2 | `src/backend/filesystem/NoteRepository`, `src/backend/watcher/` | `REQ-005.discovery.integration`, `REQ-006.watcher.integration` | SSE `note.*` events, pino `scan`/`watch` ops |
| Search stale / wrong ranking / degraded banner | search worker, index budget, checkpoints | `REQ-009/010`, §4.3 | `src/backend/search/` | `REQ-009.search.performance`, `REQ-010.index.integration`, `WF-011.rebuild.spec` | `index.status` SSE, worker error union, `SEARCH_DEGRADED` 503 |
| 401 loop / blank app after open | capability flow, bootstrap fragment | `REQ-027`, ADR-003, §4.1 | `src/backend/security/`, `src/frontend/services/` API client | capability unit suite, `REQ-027.boundary.security` | `LOCAL_ACCESS_REQUIRED` 401, no token in logs |
| Save stuck `Saving` / `Conflict` wrongly / data loss report | autosave scheduler, version tokens, atomic writer, SSE self-suppression | `REQ-017/018/023`, §2.5, §4.5 | `src/frontend/stores/` editor store, `src/backend/routes/` content PUT, `AtomicFileWriter` | `WF-006.autosave.spec`, `WF-007.conflict.spec`, `REQ-023.atomic.integration` (fault injection) | `NOTE_CONFLICT` 409, `X-Operation-ID` mismatch, pino `write` op |
| Toolbar writes wrong Markdown / selection jumps | markdown-commands transforms, toolbar dispatch | `REQ-015`, §4.6 | `src/frontend/editor/markdown-commands.ts`, `MarkdownToolbar.tsx` | `tests/unit/markdown-commands.spec.ts` | none (client-only) |
| Archive list empty / restore or delete fails | archive repository, restore/delete service, recycle bin | `REQ-039/040`, §4.13 | `src/backend/routes/archive.ts`, `NoteMutationService`, `shell/ArchiveNoteView.tsx` | `tests/api/archive-routes.spec.ts`, mutation unit suite | `NOTE_EXISTS` 409, `NOTE_NOT_FOUND` 404 |
| Preview shows raw/blocked content, image missing | render/sanitize pipeline, asset guard | `REQ-014/028`, §4.6 | `src/backend/routes/` markdown render + assets | `REQ-028.xss.security` corpus | `ASSET_BLOCKED` 403, sanitizer strip |
| `<copy>` affordance missing/copies wrong text | copy mark, preview wrapper, clipboard | `REQ-036`, §4.12, §4.7 | `src/frontend/editor/` copy mark, preview component | `REQ-036.copymark.e2e` | toast failure copy |
| Settings not persisting / theme flicker / pane snap-back | config mutex, optimistic rollback, pane state | `REQ-021/034`, §2.7, §4.10 | `src/backend/config/`, `src/frontend/stores/` workspace UI state | `WF-010.settings.spec`, `WF-012.panes.spec` | `INVALID_SETTING` 422, `settings.changed` SSE |
| Find-in-note wrong count / editor lag | find controller, decoration plugin, 500-match cap | `REQ-035`, §4.11 | `src/frontend/editor/` find plugin, `<FindInNoteBar>` | `WF-013.find.spec` | none (client-only) |
| App slow at 10k notes / memory growth | virtualization, index budget, pagination | `REQ-031`, §4.2-4.3 | `<NotesVirtualList>`, worker budget ledger | `REQ-031.performance`, soak test | perf report, `metadata-only` labels |
| CI red | workflow gates | `.github/workflows/ci.yml`, ADR-006 | workflow file, slop/gitleaks configs | rerun with `gh run view --log-failed` | job step logs |
| Wrong file permissions / symlink escape report | path guard, POSIX modes | `REQ-027`, §2.2, §2.4 | `src/backend/filesystem/WorkspacePathGuard` | traversal + symlink race suite | `PATH_OUTSIDE_WORKSPACE` 403 |

## 8. PII Inventory

Not applicable — no personal data stored by the application; note content belongs to the user on their own disk and never leaves the machine (`REQ-026`). No inventory rows required unless a future feature transmits or persists data outside the workspace.
