# Local-Notes MasterPrompt

Status: Approved technical source  
Product source: `PRD.md`  
Concept source: `project prompt.txt`

## 1. System Architecture and Stack

### 1.1 Runtime Topology

```text
local-notes CLI
  -> workspace bootstrap + exclusive lock
  -> Fastify server on 127.0.0.1:8989
     -> Vite-built React SPA
     -> REST API /api/v1/*
     -> SSE /api/v1/events
     -> filesystem services
     -> search worker thread
  -> default browser
```

- Single Node.js process; one search worker thread.
- One 256-bit random launch capability lives only in server process memory.
- Production package serves built SPA from Fastify.
- Development: Vite dev server proxies `/api/v1` and `/api/v1/events` to Fastify; packaged/E2E path always uses `127.0.0.1:8989`.
- No database, Redis, cloud service, remote API, account system, telemetry, or hosted deployment.
- Filesystem remains source of truth. Cache and search index are disposable.

### 1.2 Approved Stack Deviations

| Standard surface | Local-Notes decision | Basis |
|---|---|---|
| Next.js App Router | React + Vite SPA | User-approved concept authority |
| API Routes / Server Actions | Fastify REST + SSE | Local Node server requirement |
| Prisma/PostgreSQL | Filesystem adapters | `PRD.md` filesystem-source requirement |
| NextAuth/Auth.js + roles | No authentication; loopback-only Local Operator | Single-user local application |
| Redis rate limits | Bounded in-memory limiter | Single process, loopback-only, offline |
| Sentry | Pino local rotating logs | No telemetry or outbound traffic |
| VPS/Docker/Coolify | npm package executed through `npx` | Local-only release |
| Mobile-first responsive | Desktop/laptop minimum `1024x640` | User-approved deviation; ADR at Step 12 |

### 1.3 Runtime Dependencies

| Package family | Owner | Admission |
|---|---|---|
| React, TypeScript, Vite, Tailwind CSS, Zustand | Frontend | Project concept |
| Fastify, Zod, Pino | Local server | Project concept |
| CodeMirror 6 + Markdown language support | Single editing surface: plain text and Markdown source with formatting toolbar (`REQ-015`, ADR-008; TipTap removed in feedback round 2) | User approved |
| `@codemirror/search` | Find-in-note match highlight/navigation, source/plain-text mode (`REQ-035`) | Official first-party CodeMirror package; companion to already-approved CodeMirror 6 |
| `@codemirror/commands` | Toolbar undo/redo dispatch (`REQ-015`) | Official first-party CodeMirror package |
| `trash` | Delete archived note to OS recycle bin (`REQ-040`, ADR-009) | User approved; MIT; bundles per-OS helper binaries, no network |
| Orama | Full-text/fuzzy index | Project concept |
| chokidar | Filesystem watcher | Project concept |
| `@tanstack/react-virtual` | 10,000-note list virtualization | Project concept |
| `@fastify/static` | Serve packaged Vite output | User approved; Fastify integration |
| `open` | Cross-platform default-browser launch | User approved; native browser launch |
| `marked` + `sanitize-html` | Server-side Markdown preview pipeline | User approved; content safety |
| Vitest, Testing Library, Playwright | Unit/component/E2E | Project concept |

- Pin dependency majors without `^`; exact versions selected in Step 12 after compatibility check.
- No runtime dependency added outside table without `arch/core.md` §1.1 admission and user approval.
- Do not add Orama persistence plugin. Use `@orama/orama` raw `save`/`load`; persisted index remains disposable.

### 1.4 Source Layout

```text
src/
  cli/
    index.ts
    launch.ts
  backend/
    app.ts
    server.ts
    routes/
    filesystem/
    search/
    watcher/
    config/
    logging/
    security/
  frontend/
    app/
    pages/
    components/
    editor/
    stores/
    services/
    styles/
  shared/
    contracts/
    schemas/
    constants/
    errors/
tests/
  unit/
  integration/
  api/
  e2e/
  performance/
```

### 1.5 Build and Package Contract

- `package.json`:
  - `name`: `local-notes`
  - `type`: `module`
  - `bin.local-notes`: compiled CLI entry
  - `files`: compiled CLI/server/shared code plus Vite client output
  - `engines.node`: Active LTS major selected at Step 12
- Server/shared/CLI compile through `tsc` NodeNext configuration.
- Frontend builds through Vite into `dist/client`.
- CLI output preserves executable shebang.
- `npm pack` acceptance test installs tarball into isolated temporary prefix and launches package with npm cache offline.
- Distribution (ADR-007, supersedes npm publish plan): no npm publish; repository stays private. Version-tag workflow runs verify gates, `npm pack`, and attaches the tarball to a GitHub Release. Install = `npm install -g ./local-notes-<version>.tgz` once (then `local-notes` / `npx local-notes`) or `npx ./local-notes-<version>.tgz`.
- CI rejects lockfile dependencies with lifecycle install scripts unless exact package/version is reviewed and allowlisted (`scripts/lifecycle-allowlist.json`).
- Graceful shutdown order: stop accepting requests -> close SSE clients -> close watcher -> flush search cache -> terminate worker -> release workspace lock -> close logs.

### 1.6 Frontend Navigation

- No router dependency for MVP.
- `AppRouter` wraps browser History API and parses exact routes:
  - `/`
  - `/notes/:noteKey`
  - `/settings`
  - `/recovery/search`
- Unknown client path redirects to `/` without server request.
- `popstate` restores route; navigation preserves dashboard query/sort/scroll in Zustand session state.
- Fastify static fallback serves `index.html` only for known client routes; unknown non-API paths return `404`.

## 2. Database and Data Integrity

### 2.1 Database Decision

- No database and no Prisma models.
- Domain records are files, configuration JSON, disposable metadata cache, disposable Orama index, local logs, and workspace lock.
- Any future database introduction requires PRD change, approved architecture deviation, and ADR.

### 2.2 Workspace Paths

```text
~/.local-notes/
  save-data/
    notes/
    archive/
    attachments/
    templates/
  backups/
  exports/
  cache/
    metadata-v1.json
    search-index-v1.json
  logs/
  plugins/
  config.json
  .lock
```

- MVP reads/writes active notes only under `save-data/notes`.
- Archive mutation writes under `save-data/archive`.
- Markdown assets resolve against `save-data`; attachment/template management remains deferred.
- Deferred directories are initialized for forward compatibility but expose no MVP controls.
- POSIX initialization creates application directories with mode `0700` and application-managed files/temp files with `0600`; existing user files retain their permissions.
- Reject symlink/junction application root, config, lock, cache, and log paths.

### 2.3 Canonical Types

```ts
type NoteExtension = ".md" | ".txt";
type NoteMode = "read" | "edit" | "source" | "split";
type SaveState = "saved" | "unsaved" | "saving" | "conflict" | "error";
type WorkspaceLayout = "standard" | "focus";

interface NoteMetadata {
  noteKey: string;
  relativePath: string;
  filename: string;
  title: string;
  extension: NoteExtension;
  folder: string;
  createdAt: string | null;
  modifiedAt: string;
  sizeBytes: number;
  versionToken: string;
  oversized: boolean;
  preview: string;
}

interface NoteDocument extends NoteMetadata {
  content: string;
  textEncoding: "utf8" | "utf8-bom" | "unsupported";
  lineEnding: "lf" | "crlf" | "none";
}
```

- `noteKey` = base64url encoding of normalized POSIX relative path under active notes root.
- `noteKey` is opaque to frontend; every decode passes path-boundary validation.
- `versionToken` = SHA-256 of file bytes plus normalized relative path. Never trust timestamp alone.
- `createdAt` uses filesystem birth time only when valid; otherwise `null`.
- `TextFileCodec` detects UTF-8 BOM, decodes with fatal UTF-8 handling, and detects consistent `LF`, `CRLF`, or no line ending.
- Editor state normalizes line endings to `\n`; save restores original BOM and line-ending style.
- Invalid UTF-8 returns metadata plus read-only unsupported-encoding state and never enters save pipeline.

### 2.4 Path Boundary Algorithm

Every filesystem operation uses one shared `WorkspacePathGuard`:

1. Decode/accept relative path only; reject absolute path, NUL, drive prefix, UNC prefix, and empty segments.
2. Normalize separators to platform form.
3. Resolve candidate from approved root.
4. Resolve nearest existing ancestor through `realpath`.
5. Reject ancestor or final target escaping approved root after case-normalized comparison.
6. Reject symlink/junction traversal for mutable note targets.
7. Use `lstat` before read/write/move/archive and open regular files with no-follow semantics where platform supports it.
8. Compare opened handle identity/stat to validated path before use.
9. Revalidate source and destination immediately before mutation.

- Never concatenate user input into raw filesystem path.
- Note filename validation and platform path acceptance tests implement `REQ-011`.
- Platform race tests swap symlinks/junctions between validation and operation; operation must fail closed.
- Filename validator enforces 120-character maximum including extension.

### 2.5 Atomic Write Protocol

All note, config, metadata-cache, and search-index writes use `AtomicFileWriter`:

1. Acquire in-process mutex keyed by canonical target path.
2. Re-read target version when mutation includes `expectedVersion`.
3. Create unique adjacent temp file with exclusive mode.
4. Write complete bytes.
5. Flush file handle.
6. Recheck target version before replacement.
7. Rename temp over target atomically.
8. Flush parent directory where platform supports it.
9. Remove temp on handled failure.
10. Return new `versionToken`.

- Version mismatch returns `409 NOTE_CONFLICT`; target remains unchanged.
- Move/archive use same-path mutexes sorted lexically to avoid deadlock.
- Copy-then-delete fallback across devices is prohibited because workspace mutation stays inside one root.

### 2.6 Workspace Lock

- `.lock` acquired with exclusive create (`wx`).
- Lock JSON: `instanceId`, `pid`, `hostname`, `startedAt`, `appVersion`, `workspaceRealPath`.
- Existing lock:
  - same host + live PID -> print exact required conflict message and exit;
  - dead PID -> remove stale file, retry exclusive create once;
  - unreadable/foreign-host lock -> fail closed with recovery guidance.
- Release only when `instanceId` still matches.
- Reject lock path when existing entry is symlink/junction or non-regular file.
- Signal handlers cover `SIGINT`, `SIGTERM`, normal shutdown, and startup rollback.

### 2.7 Configuration

```ts
interface ConfigV1 {
  version: 1;
  theme: "system" | "light" | "dark";
  workspace: string;
  editorFontSize: number;
  lineHeight: number;
  sortBy: "name" | "created" | "modified" | "size";
  sortDirection: "asc" | "desc";
  folderPaneWidth: number;
  notesPaneWidth: number;
  folderPaneCollapsed: boolean;
  notesPaneCollapsed: boolean;
}
```

- Zod validates load and update.
- Exact defaults come from `PRD.md` `REQ-021`.
- Appearance schema:
  - theme enum, default `system`;
  - editor font integer `12..24`, default `14`;
  - line height numeric `1.2..2.0`, default `1.6`;
  - no editor width field (round 2b): editor and preview always fill their pane; unknown keys in older config files strip on parse.
- Workspace layout schema (`REQ-034`): folderPaneWidth integer `190..280` default `220`; notesPaneWidth integer `280..420` default `320`; folderPaneCollapsed and notesPaneCollapsed booleans, default `false`. Fields apply across the supported viewport range (`>=1024px`, `Design_System.md` §4.3 v1.5).
- `workspace` is canonical and read-only in MVP.
- Unsupported version or invalid structural JSON blocks startup; invalid individual appearance fields use exact defaults and produce local warning.
- Migration registry uses `fromVersion -> toVersion`; migration writes atomically and preserves original on failure.

### 2.8 Cache Integrity

- `metadata-v1.json`: schema version, generated time, per-path stat/hash/preview metadata.
- `search-index-v1.json`: Orama raw saved data plus index schema version.
- Startup loads cache only after Zod validation and version match.
- Warm reconciliation compares path, size, and modified time; changed/new/deleted entries update incrementally.
- Cache parse/load mismatch deletes no source file. Rebuild writes new cache atomically.

## 3. Authentication and Role System

- No authentication, user records, sessions, passwords, OTP, email, role dashboards, or developer dashboard.
- Sole human role: Local Operator.
- System actor: Local Process.
- Authorization boundary is launch capability plus workspace path guard and loopback/origin enforcement.
- Fastify binds only `127.0.0.1:8989`; never `localhost`, `0.0.0.0`, `::`, or LAN interface.
- Every mutation requires:
  - `Host: 127.0.0.1:8989`
  - `Origin: http://127.0.0.1:8989`
  - declared JSON or plain-text content type
  - valid Zod payload
- Every API, event-stream, and asset request requires `X-Local-Notes-Token`.
- Server compares token with in-memory capability through timing-safe byte comparison.
- Missing, invalid, or stale token returns `401 LOCAL_ACCESS_REQUIRED` before workspace metadata or body parsing.
- Browser API wrapper reads token only from `sessionStorage`; never localStorage, cookie, persisted Zustand state, query string, log, cache, error payload, or service worker.
- No permission is inferred from obscurity of local URL.

## 4. Feature Implementation

### 4.1 CLI, Bootstrap, and Browser Launch

- `src/cli/index.ts` orchestrates config root, workspace creation, lock, logger, search worker, watcher, Fastify, and browser.
- Server starts before browser launch.
- CLI generates capability with `randomBytes(32).toString("base64url")`.
- Launch URL is `http://127.0.0.1:8989/#access=<capability>`.
- Bootstrap script reads fragment, writes token to `sessionStorage`, then removes fragment through `history.replaceState` before first API request.
- Browser-launch failure prints one-time launch URL and keeps process alive; terminal copy is sensitive until process exits.
- New tab without token shows secure relaunch instruction; user may use current one-time launch URL.
- Port collision maps platform error to blocking-process details when available.
- Startup failure closes every initialized resource in reverse order.
- CLI uses stable exit codes:
  - `0` clean shutdown
  - `2` workspace lock
  - `3` port unavailable
  - `4` config/workspace invalid
  - `1` unexpected startup failure

### 4.2 Discovery and Watcher

- `NoteRepository.scan()` recursively traverses active notes root with bounded concurrency `16`.
- Include case-insensitive `.md` and `.txt`; normalize stored extension to actual lowercase comparison while preserving filename.
- Skip symlinks/junctions, unsupported files, cache/temp artifacts, and unreadable paths.
- Dashboard list endpoint returns metadata pages of `500`; frontend appends and virtualizes without user-facing pagination.
- Metadata preview caps at 240 characters.
- List query scopes (round 2): `folder` (comparison-only, WF-001), `recent=true` (modified within 7 days), `archived=true` (archive-tree repository); `/folders` returns direct counts plus workspace/recent/archived totals.
- Chokidar watches active notes root:
  - `followSymlinks=false`;
  - coalesce path events for `100 ms`;
  - ignore Local-Notes temp files;
  - map add/change/unlink/rename pairs into repository updates;
  - update metadata, search worker, and SSE after final state.
- External change target: UI receives final event within PRD limit.

### 4.3 Search Worker

- `node:worker_threads` owns Orama instance and index serialization.
- Worker message union:
  - `INIT`
  - `UPSERT`
  - `REMOVE`
  - `SEARCH`
  - `REBUILD`
  - `SAVE`
  - `STATUS`
  - `SHUTDOWN`
- Every request carries `requestId`; every response is success or typed error.
- Index schema: `noteKey`, `title`, `filename`, `content`, `relativePath`, `extension`, `modifiedAt`, `sizeBytes`, `truncated`.
- Content indexing cap = first 5 MiB.
- Aggregate content budget = 512 MiB measured in UTF-8 bytes before insertion.
- Rebuild sorts eligible notes by `sizeBytes` ascending then relative path; notes exceeding remaining budget receive empty indexed content and `contentIndexStatus="metadata-only"`.
- Incremental upsert maintains budget ledger:
  - changed note releases previous indexed byte allocation;
  - allocate new content when budget permits;
  - otherwise metadata-only;
  - schedule background rebalance after delete/archive/size reduction to fill freed budget smallest-first.
- Search results expose `contentIndexStatus`; UI labels metadata-only notes with exact PRD copy.
- Search:
  - trim query; blank query delegates to current dashboard sort;
  - Orama candidate retrieval with typo tolerance `1`;
  - post-rank tiers: exact title/filename -> partial title/filename -> exact content phrase -> remaining partial/fuzzy content;
  - tie-break: Orama score descending -> modified time descending -> relative path ascending;
  - return offset batches of exactly `200`;
  - snippet capped at 180 characters around first highest-ranked match; match ranges returned separately from text.
- Mutation updates one index document only.
- Dirty index checkpoint starts after `30 s` idle and runs at most once per `5 min`; force save on graceful shutdown.
- Startup reconciliation repairs any filesystem changes newer than last checkpoint.
- Worker crash:
  - mark search degraded;
  - editing remains available;
  - restart worker once;
  - repeated crash requires explicit rebuild through recovery screen.

### 4.4 Create, Move, and Archive

- `CreateNoteSchema`: extension enum, filename, destination folder key.
- Folder endpoint exposes existing directory tree only.
- Collision checks use Unicode-normalized case-folded filename against target directory entries.
- Create uses exclusive file creation; initial bytes empty.
- New files use UTF-8 without BOM and `LF`.
- Move renames one note between active folders; updates key, cache, worker, open-editor route, and SSE.
- Archive preserves relative path under archive root.
- Archive collision returns `409 ARCHIVE_COLLISION` with `renameAllowed: true`.
- No duplicate, permanent delete, folder mutation, or bulk mutation endpoint.

### 4.5 Note Read, Edit, and Conflict Control

- Read endpoint returns `NoteDocument`; content omitted for oversized note and `oversized=true`.
- Unsupported encoding returns metadata, empty editable content, `textEncoding="unsupported"`, and read-only reason.
- Frontend editor store keeps `noteKey`, `loadedVersion`, `draft`, `saveState`, and latest disk metadata.
- Frontend workspace UI state keeps non-persisted `layout: WorkspaceLayout`; route changes reset to `standard`.
- Focus layout (`REQ-037`, all supported note types) hides application titlebar, folder navigation, and note list; preserves editor header, title, mode controls, note actions, conflict panel, status bar, draft, selection, scroll, and save state.
- Focus layout toggles through editor toolbar and `Ctrl+Shift+F`; `Escape` restores standard layout when no modal is open.
- Autosave scheduler waits `750 ms`; only one save request in flight.
- Edit during save schedules next save after current response.
- Save request includes `expectedVersion`; success replaces loaded version.
- `409 NOTE_CONFLICT` pauses scheduler and opens conflict surface.
- SSE external events:
  - clean open note changed -> refetch;
  - dirty open note changed -> conflict;
  - clean open note renamed -> replace route/key;
  - dirty open note renamed/deleted -> source-missing state;
  - self-originated events carry operation ID and do not create false conflict.
- `Save as new note` calls create then content write; stale path is never recreated automatically.

### 4.6 Markdown Preview Pipeline

- Modes are Read / Source / Split (ADR-008, round 2): CodeMirror is the single editing surface for `.md` and `.txt`; no visual editor, no compatibility service. Every construct edits as source.
- Source-mode toolbar (`REQ-015`): pure transforms in `src/frontend/editor/markdown-commands.ts` produce original-document change spans + post-edit selection; the toolbar dispatches them into CodeMirror as ordinary undoable edits. Wrap toggles (bold/italic/underline/strike/copy-mark), heading level toggles H1-H3, line-prefix list toggles, link/table/code-block inserts, undo/redo via `@codemirror/commands`.
- Line-wrap view toggle (`REQ-015`, round 3): toolbar toggle flips `EditorView.lineWrapping` through a CodeMirror compartment; state = `workspaceUi.lineWrap`, session-only, default on, never persisted, no document change; applies to every source surface including read-only notes.
- Preview follows the same toggle (round 8): `<MarkdownPreview>` article adds `whitespace-nowrap` when `workspaceUi.lineWrap` is off - unwrapped lines scroll horizontally (`overflow-auto` already present); `pre`/`code` keep their own `white-space`, `<br>` breaks hold; toggle control stays in the Source/Split toolbar, Read mode follows the session state.
- Native spellcheck (`REQ-041`, round 5): editable CodeMirror surfaces set `EditorView.contentAttributes` `spellcheck="true"` + `autocorrect`/`autocapitalize` off, reconfigured through the read-only compartment; read-only surfaces set `spellcheck="false"`. Browser owns dictionary, wavy underline, and right-click suggestion menu; suggestions land as ordinary undoable edits through the normal change/autosave path. No app dictionary, no network (`REQ-026`).
- Copy block regions (`REQ-036`, rounds 2-3): pre-pass `src/backend/markdown/copy-blocks.ts` lifts every region whose `<copy>` starts a line (alone, with content on the open line, or closing on the same line) through the first `</copy>` ending a line, behind a random per-render placeholder (content cannot spoof it), renders inner Markdown through the full pipeline below, re-injects as `<copy data-block="">`. Round-3 rationale: raw line-starting tags left inner markdown literal and the sanitizer auto-close dropped everything after the first block from the copy element. Mid-line `<copy>` stays on marked's inline path; `data-block` is never accepted from note content; fenced `<copy>` lines stay literal.
- `POST /api/v1/markdown/render`:
  - parses with GFM tables/task lists;
  - breaks mode (round 6): single source newline inside paragraph renders `<br>`; blank-line paragraph separation and fenced code unchanged; applies to copy-block inner render;
  - sanitizes server-side;
  - allows `<u>` and `<copy>` (both attribute-less) but removes scripts, handlers, dangerous attributes, and unsafe schemes;
  - rewrites supported workspace-relative note links to internal routes;
  - marks `http`/`https` links for confirmation;
  - replaces blocked schemes/escape targets with inert text;
  - rewrites workspace-relative images to guarded asset endpoint;
  - blocks remote, data, `file://`, and escape images.
- Guarded asset endpoint:
  - validates path through `WorkspacePathGuard`;
  - allows raster extensions `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.avif`, `.bmp`, `.ico`;
  - blocks SVG and every unlisted type as active/unsupported content;
  - caps asset file size at 20 MiB;
  - verifies detected signature/MIME matches allowed extension before response;
  - sets explicit MIME, `nosniff`, no-store, and content disposition inline;
  - frontend fetches bytes with capability header, creates object URL, renders `<img>`, then revokes object URL on replacement/unmount.
- Preview requests debounce `150 ms`; frontend aborts stale request.

### 4.7 Copy

- Copy Markdown reads current draft for `.md` through `markdownForClipboard` (`src/frontend/editor/copy-actions.ts`, round 6): strips `<copy>`/`</copy>` outside fenced/inline code, drops tag-only lines; applies to workspace and archive copies.
- Copy Text (round 7) = `plainTextFromSource` (`src/frontend/editor/copy-text.ts`): per-line Markdown syntax strip over the draft, source line/blank-line structure preserved verbatim; syntax-only lines (fences, table separators, hr/setext rules) drop; no render request, works offline from the open draft; `.txt` uses literal draft. Preview-DOM `textContent` path removed - identical HTML for "heading+text" vs "heading+blank+text" makes DOM-derived line structure impossible.
- Clipboard failure maps to visible nonpersistent toast.

### 4.8 Settings and Theme

- Settings API reads/writes `ConfigV1`.
- Frontend applies system theme with `matchMedia("(prefers-color-scheme: dark)")`.
- System preference listener updates without persistence mutation.
- Dark-first tokens remain advisory until translated into `Design_System.md`.
- Sort preferences share config writer; updates serialize through one config mutex.
- Viewport below `1024x640` renders resize guidance before main shell.

### 4.9 Local Diagnostics

- Pino JSON records only operational fields: timestamp, level, requestId/operationId, operation, sanitized relative path, error code, duration.
- Never log note body, preview, search query, clipboard data, raw absolute home path, request body, or rendered HTML.
- Custom writable destination rotates each file at `10 MiB`.
- Hourly and startup retention job removes files older than 30 days, then oldest files until total <=100 MiB.
- Log maintenance failure writes one terminal warning and does not crash note workflows.

### 4.10 Workspace Pane Resize (`REQ-034`)

- Divider between folder pane and note list, and between note list and editor, implemented as `<PaneDivider>` (`Design_System.md` §9) with ARIA `separator` role, `aria-orientation="vertical"`, `aria-valuenow`/`aria-valuemin`/`aria-valuemax` mirroring current/min/max width.
- Drag updates width via pointer events; release commits value. Keyboard: divider focused, arrow keys resize in `8px` increments, `Home`/`End` snap to min/max.
- Divider active across the whole supported viewport range (`>=1024px`, the `REQ-031` minimum). Display scaling routinely puts real windows under `1280` CSS px; the original `desktop`-only gate made resize/collapse unreachable there (user feedback round 1, `Design_System.md` §4.3 v1.5).
- Split mode adds a third divider between editor and preview (`<SplitDivider>`): drag or arrow keys move the split fraction (`0.2..0.8`, 5% keyboard steps, Home/End snap, double-click resets to half); vertical bar for side-by-side, horizontal for stacked layouts. Fraction is session state - never persisted.
- Width commits debounce `250ms` then `PUT /api/v1/settings` with only the changed field; collapse/expand commits immediately. `422`/network failure rolls the pane back to its last-persisted width or collapsed state — same optimistic-rollback rule as `WF-010` theme changes (§6.2).
- Collapsed-pane prior width held in local Zustand session state (not persisted) so restore uses last known width without a settings round-trip; only the collapsed boolean persists in `ConfigV1`.
- No new endpoint; reuses existing `/api/v1/settings` route and `ConfigV1` schema (§2.7).

### 4.11 Find in Note (`REQ-035`)

- Client-side only; operates on the already-loaded editor draft/content in memory. No new API route, no filesystem read, independent of dashboard search (`REQ-009`).
- One shared literal scan module feeds every surface so match counts agree across modes; query always literal, case-insensitive by default with explicit case toggle.
- Source/plain-text mode (CodeMirror): decoration `StateField` over the shared scan; `basicSetup`'s native `@codemirror/search` panel keymap is shadowed with a highest-precedence `Mod-f` binding so `<FindInNoteBar>` (`Design_System.md` §9) is the only search UI.
- Read/split preview: CSS Custom Highlight API ranges over the sanitized article's text nodes, segmented per block element — never mutates the sanitized subtree (§7.2). Browsers without the API keep accurate counts and navigation without painted highlights.
- Split view: source pane owns the count; both panes track the shared active index (round 9). Rendered text can hold fewer matches than source (markdown syntax never renders) — `applyPreviewFind` clamps the index to the last rendered match; negative index = explicit no-active.
- Shortcut `Ctrl+F` intercepted via `keydown` + `preventDefault` while a note is open and focus is inside the workspace. `Escape` closes find and returns focus to the point find was invoked from, per existing Escape-closes-transient-layer pattern (`Design_System.md` §11).
- Selection prefill (round 9): text selected at `Ctrl+F` seeds the query — source editor passes the CodeMirror doc slice (viewport-independent), any other surface the DOM selection. `queryFromSelection` = first line, trimmed, 200-char cap. Seeded query arrives selected in the input so typing replaces it; re-invoking `Ctrl+F` on a new selection re-seeds an open bar. Shell listener skips events the source editor already handled (`defaultPrevented`).
- Match count and current position exposed via `role="status"` live region on the find bar; only the first jump-to-match scrolls the document automatically.
- Debounce query input `150ms` before re-scanning; abort stale scan on rapid retyping.
- Match highlighting capped at first `500` matches per note to bound render cost on pathological repetitive content; total match count stays accurate beyond the cap.

### 4.12 Copyable Text Mark (`REQ-036`)

- Authored in source mode: toolbar wrap toggle or literal `<copy>...</copy>` (inline) / line-starting `<copy>` region (block form, §4.6, rounds 2-3).
- Source mode colors the literal tags (round 4): `src/frontend/editor/cm-copy-tag.ts` MatchDecorator marks `<copy>`/`</copy>` with `--color-copy-tag` (`Design_System.md` §2.2); wired in the language compartment so `.txt` stays unstyled; decoration only, never an edit.
- Read/split preview: server-sanitized HTML passes `<copy>` through the allowlist (§4.6); the preview component mounts an inline `<IconButton>` (`Design_System.md` §9) after each rendered `<copy>` element client-side — the sanitized HTML itself carries no button markup.
- Click-to-copy (round 2): clicking anywhere in the rendered `<copy>` element copies it; anchors inside still follow link policy first.
- Clipboard text is line-aware (`src/frontend/editor/copy-mounts.ts`): block children join with newlines, table cells with tabs, `<br>` breaks; nested Markdown is already stripped by rendering. Same clipboard mechanism + toast as `Copy Text` (§4.7).

### 4.13 Archive Browser (`REQ-038`/`REQ-039`/`REQ-040`)

- Sidebar library rows: `Recent` = `GET /notes?recent=true` (7-day modified window, `RECENT_WINDOW_DAYS`); `Archive` = `GET /notes?archived=true` over a second `NoteRepository` rooted at `save-data/archive`. Counts ride on `/folders`.
- Archive keys are archive-root-relative; only `/archive/*` routes accept them. Active-note routes never resolve them.
- Archived note opens read-only at `/archive/:noteKey` (`<ArchiveNoteView>`): `.md` renders through the preview pipeline, `.txt` uses the read-only plain editor; no editor state machine, no save pipeline.
- Restore = `NoteMutationService.restore`: mirror of archive() (same path-lock map, case-fold collision, no overwrite) from archive root into an existing active folder; route registers the operation ID for the watcher add event and upserts the search index.
- Delete = `NoteMutationService.deleteArchived`: resolves through the path guard, asserts the file, hands the absolute path to the injected trash function (`trash` dependency -> OS recycle bin, ADR-009). Archive tree is unwatched - frontend refreshes the scoped list explicitly after delete.
- The application never unlinks note content itself; active notes have no delete path.

## 5. REST and Event Contracts

### 5.1 Common Contract

```ts
interface ApiSuccess<T> {
  data: T;
  requestId: string;
}

interface ApiError {
  error: {
    code: string;
    message: string;
    fieldErrors?: Record<string, string[]>;
  };
  requestId: string;
}
```

- API prefix `/api/v1`.
- Fastify `bodyLimit = 8 * 1024 * 1024`.
- Zod schemas live in `src/shared/schemas`; frontend imports request/response types, never server implementation.
- JSON is default API body format.
- Note content and Markdown render requests use `text/plain; charset=utf-8` to avoid JSON escaping overhead.
- Fastify registers explicit `text/plain` buffer parser with same body limit, then decodes through fatal UTF-8 `TextDecoder`.
- Content save sends expected version through `If-Match` and operation UUID through `X-Operation-ID`.
- Markdown render sends note key through validated `X-Note-Key`.
- Error messages omit absolute internal paths and stack traces.
- Internal request IDs use `crypto.randomUUID()`.
- Capability hook runs before body parsing and route handler execution.

### 5.2 Endpoints

| Method | Path | Input | Output | Errors |
|---|---|---|---|---|
| GET | `/health` | none | process/workspace/index status | `503 NOT_READY` |
| GET | `/bootstrap` | none | config, workspace display path, index status, capabilities | `500 BOOTSTRAP_READ_FAILED` |
| GET | `/notes` | cursor, limit<=500, sort, direction, folder, recent, archived | metadata page (active, recent-scoped, or archive tree) | `400 INVALID_QUERY` |
| GET | `/notes/:noteKey` | key | `NoteDocument` | `404 NOTE_NOT_FOUND`, `403 PATH_OUTSIDE_WORKSPACE` |
| POST | `/notes` | filename, extension, folderKey | metadata | `409 NOTE_EXISTS`, `422 INVALID_FILENAME` |
| PUT | `/notes/:noteKey/content` | raw text body, `If-Match`, `X-Operation-ID` | metadata + new version | `409 NOTE_CONFLICT`, `413 BODY_TOO_LARGE` |
| POST | `/notes/:noteKey/move` | destinationFolderKey, operationId | new metadata/key | `409 NOTE_EXISTS`, `404 FOLDER_NOT_FOUND` |
| POST | `/notes/:noteKey/archive` | optional validated replacement filename, operationId | archived relative path | `409 ARCHIVE_COLLISION` |
| GET | `/folders` | none | active folder tree + direct counts + workspace/recent/archived totals | `500 FOLDER_SCAN_FAILED` |
| GET | `/archive/:noteKey` | archive-root key | read-only `NoteDocument` | `404 NOTE_NOT_FOUND`, `403 PATH_OUTSIDE_WORKSPACE` |
| POST | `/archive/:noteKey/restore` | destinationFolderKey, operationId | restored metadata (active key) | `409 NOTE_EXISTS`, `404 FOLDER_NOT_FOUND` |
| DELETE | `/archive/:noteKey` | archive-root key | deleted status | `404 NOTE_NOT_FOUND` |
| GET | `/search` | q, offset multiple of 200, limit=200 | results + total + hasMore | `503 SEARCH_DEGRADED` |
| POST | `/search/rebuild` | none | accepted status | `409 REBUILD_RUNNING` |
| POST | `/markdown/render` | raw Markdown body, `X-Note-Key` | sanitized HTML | `413 BODY_TOO_LARGE`, `422 INVALID_MARKDOWN` |
| GET | `/assets/:assetKey` | encoded workspace-relative asset path | image bytes | `404 ASSET_NOT_FOUND`, `403 ASSET_BLOCKED` |
| GET | `/settings` | none | `ConfigV1` | `500 CONFIG_READ_FAILED` |
| PUT | `/settings` | partial appearance/view/sort fields; workspace excluded | `ConfigV1` | `422 INVALID_SETTING` |

### 5.3 SSE

- `GET /api/v1/events`; response `text/event-stream`, heartbeat every `15 s`.
- EventSource cannot set required token header; frontend consumes authenticated event stream with `fetch` streaming reader.
- Event union:
  - `workspace.ready`
  - `note.added`
  - `note.changed`
  - `note.renamed`
  - `note.removed`
  - `index.status`
  - `settings.changed`
- Note events include old/new key where applicable, new version, operation ID when internal, and no content.
- Reconnect sends full bootstrap refresh; no historical event replay.

### 5.4 In-Memory Rate Limits

| Family | Limit | Caller behavior |
|---|---:|---|
| General reads | 600/min | exponential retry only on `429` |
| Search | 300/min | UI debounce prevents normal exhaustion |
| Markdown render | 300/min | abort stale requests |
| Mutations | 120/min | no automatic retry except user action |
| Search rebuild | 2/5 min | disable action while running |

- Sliding-window buckets keyed by route family plus remote socket address.
- Map capped at 1,024 keys; expired keys removed every minute.
- Process restart clears limits by design.

## 6. Dashboard Implementation Map

### 6.1 Screen Map

| ID | Route/surface | Owner | Data source | Required states | Visual source |
|---|---|---|---|---|---|
| `SCREEN-001` | `/` | `DashboardPage` | notes/search/folders APIs + SSE | loading, empty, populated, partial error, search no-result | `Design_System.md` v1.3 LOCKED; `PRODUCT.md` advisory |
| `SCREEN-002` | `/notes/:noteKey` | `NoteWorkspacePage` | note/render/assets APIs + SSE | loading, read, edit, source, split, focus, oversized, missing, error | `Design_System.md` v1.3 LOCKED |
| `SCREEN-003` | `/settings` | `SettingsPage` | settings API | loading, ready, invalid field, persistence error | `Design_System.md` v1.3 LOCKED |
| `SCREEN-004` | CLI terminal | `WorkspaceLockPresenter` | lock service | active owner, stale recovery failure | CLI copy standard |
| `SCREEN-005` | CLI terminal | `StartupErrorPresenter` | bootstrap/server errors | config, workspace, port, unexpected | CLI copy standard |
| `SCREEN-006` | Note workspace conflict panel | `ConflictPanel` | editor store + note API | changed, source missing, resolving, resolution error | `Design_System.md` §9 `<ConflictPanel>` + `<ConfirmationDialog>` |
| `SCREEN-007` | `/recovery/search` | `SearchRecoveryPage` | search status/rebuild + SSE | degraded, rebuilding, ready, failed | `Design_System.md` §9 `<SearchRecoveryPanel>` |
| `SCREEN-008` | `/archive/:noteKey` | `ArchiveNoteView` | archive content/restore/delete APIs | loading, read-only, missing, restore dialog, delete confirm | `Design_System.md` §9 composition (round 2) |

### 6.2 Workflow Map

| ID | UI/action owner | Transition | Guard | Audit event | Concurrency/optimistic rule | Test |
|---|---|---|---|---|---|---|
| `WF-001` | `DashboardPage` + `NotesVirtualList` | loading -> populated/empty/partial error | Local Operator + path guard | none; no behavioral audit | append metadata pages; dedupe by key | `WF-001.discovery.spec` |
| `WF-002` | `SearchCommand` | idle -> searching -> results/no-result/degraded | query schema + search limiter | none | abort stale request; append 200 | `WF-002.search.spec` |
| `WF-003` | `CreateNotePanel` | editing -> validating -> created/error | create schema + path guard | none | disable submit in flight; exclusive create | `WF-003.create.spec` |
| `WF-004` | `DashboardToolbar` | current -> view/sort updated | settings schema | none | optimistic UI; rollback on config error | `WF-004.preferences.spec` |
| `WF-005` | `NoteWorkspacePage` | loading -> editable/read-only/error | note key + path guard | none | route request abort on navigation | `WF-005.open.spec` |
| `WF-006` | `EditorController` | saved -> unsaved -> saving -> saved/error/conflict | size cap + expected version | none | one in-flight save; queue latest draft | `WF-006.autosave.spec` |
| `WF-007` | `ConflictPanel` | conflict -> reload/overwrite/save-as/close -> resolved/error | explicit user action | none | autosave paused until resolution | `WF-007.conflict.spec` |
| `WF-008` | `MoveNotePanel` | choose -> validating -> moved/error | folder + path + collision checks | none | source/destination mutex; no optimistic path | `WF-008.move.spec` |
| `WF-009` | `ArchiveAction` | confirm -> archiving -> archived/collision/error | archive path guard | none | no optimistic removal; update after rename | `WF-009.archive.spec` |
| `WF-010` | `SettingsForm` | current -> validating -> applied/error | config schema | none | optimistic theme only; persisted values rollback | `WF-010.settings.spec` |
| `WF-011` | `SearchRecoveryPage` | degraded -> rebuilding -> ready/error | rebuild limiter + single-flight guard | none | one rebuild; editing unaffected | `WF-011.rebuild.spec` |
| `WF-014` | `ArchiveNoteView` restore panel | choose folder -> validating -> restored/error | restore schema + path guard + collision | none | no optimistic move; navigate to restored key on success | `archive-routes.spec` |
| `WF-015` | `ArchiveNoteView` delete confirm | confirm -> deleting -> deleted/error | explicit confirmation + path guard | none | no optimistic removal; explicit list refresh (archive unwatched) | `archive-routes.spec` + `archive-note-view.spec` |

## 7. Security and Error Handling

### 7.1 Server Boundary

- Bind exact IPv4 loopback.
- `trustProxy=false`.
- Reject unexpected Host before routing.
- Reject missing/invalid launch capability before workspace routes.
- Mutation Origin equality check; no wildcard CORS.
- Production headers:
  - per-response nonce;
  - `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'nonce-{nonce}'; img-src 'self' blob:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: no-referrer`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- No HSTS: HTTP loopback-only application, no public transport.
- Fastify serves nonce-injected `index.html`; CodeMirror receives same nonce through its `cspNonce` facet.
- Static server disables dotfile serving, directory listing, source maps, and arbitrary filesystem fallthrough.
- Production Vite build contains no remote asset URL, CDN import, source map publication, or `unsafe-eval`.

### 7.2 Content Boundary

- Never execute note content.
- Never use unsanitized `dangerouslySetInnerHTML`.
- Only server-sanitized preview HTML reaches preview component.
- Link click handler enforces internal/external/blocked classification again client-side.
- External URL confirmation shows exact hostname; no automatic request.
- Asset route never serves HTML as image through MIME sniffing.

### 7.3 Error Taxonomy

| Category | HTTP/exit | Caller behavior |
|---|---|---|
| Validation | 400/422 | preserve form/draft, show field error |
| Boundary/security | 403 | generic blocked message, local warning log |
| Missing source | 404 | preserve draft, retry/back/save-as options |
| Conflict/collision | 409 | explicit resolution UI |
| Oversized | 413/read-only response | preserve file, disable mutation |
| Rate limit | 429 | respect `Retry-After` |
| Search degraded | 503 | editing available; recovery link |
| Filesystem/config internal | 500 | preserve user data; request ID + retry |

- Global Fastify error handler maps known errors; unknown errors log stack locally and return generic message.
- Browser error boundary preserves route and offers reload/back; never discards editor draft silently.

## 8. Test and Validation Strategy

### 8.1 Unit

- Path traversal, symlink/junction, case-fold collision, reserved filename, note-key codec.
- Capability entropy, timing-safe comparison, stale-token rejection, fragment removal, and storage/log leakage.
- Config migration/defaults.
- Atomic writer fault injection at every stage.
- Lock live/stale/race behavior.
- Search ranking, batching, snippets, truncation.
- Markdown compatibility corpus and sanitizer/XSS corpus.
- Rate limiter bounds and cleanup.

### 8.2 Integration/API

- Temporary real filesystem per test.
- Fastify injection tests for every endpoint/error.
- Worker init/upsert/remove/save/load/rebuild/crash.
- Chokidar external create/update/rename/delete.
- Conflict token race and internal operation-ID suppression.
- Log rotation/retention with fake clock.

### 8.3 Component

- Keyboard operation, focus order, focus-layout toggle/restore, save-state announcements, conflict choices.
- Virtualized list behavior at 10,000 rows.
- Theme defaults/system changes.
- Resize guidance at unsupported viewport.
- Sanitized preview and confirmed external links.

### 8.4 End-to-End

- Packaged server at `127.0.0.1:8989`.
- Network disabled after local package availability.
- Create/edit/restart/search/move/archive.
- External editor modifications.
- Workspace lock second process.
- Oversized note read-only.
- Search degradation/rebuild.
- Viewports `1024x640`, `1280x720`, `1440x900`.
- Windows 11, release-current/previous macOS, release-current Ubuntu LTS.

### 8.5 Performance and Evidence

- Benchmark fixture: 10,000 notes with controlled size distribution and nested folders.
- Startup clock: process start -> browser bootstrap marks interactive.
- Search clock: API receive -> ranked response ready; warm index.
- Soak: 30 minutes alternating edit/search/external changes; track heap after forced idle stabilization.
- Metrics write only test stdout/JUnit/JSON evidence under `.qa/`; never runtime analytics.

## 9. Traceability Map

### 9.1 Requirements

| Source | Implementation owner | Data model | Validation | Acceptance test |
|---|---|---|---|---|
| `REQ-001` | CLI launch + Fastify bootstrap | lock/server state | launch environment | `REQ-001.launch.e2e` |
| `REQ-002` | workspace/config bootstrap | `ConfigV1`, directories | config schema | `REQ-002.bootstrap.integration` |
| `REQ-003` | `WorkspaceLock` | lock JSON | lock schema | `REQ-003.lock.e2e` |
| `REQ-004` | platform adapters + CI matrix | path/lock abstractions | platform acceptance | `REQ-004.platform.e2e` |
| `REQ-005` | `NoteRepository.scan` + dashboard | `NoteMetadata` | extension/path guard | `REQ-005.discovery.integration` |
| `REQ-006` | watcher pipeline + SSE | file event union | event schema | `REQ-006.watcher.integration` |
| `REQ-007` | dashboard list + virtualizer | `NoteMetadata` page | list query schema | `REQ-007.views.component` |
| `REQ-008` | metadata sort service | sort preference | sort enum | `REQ-008.sort.unit` |
| `REQ-009` | search worker + command UI | search result DTO | query schema | `REQ-009.search.performance` |
| `REQ-010` | incremental index, 512 MiB budget ledger, recovery | index status/allocation | worker messages | `REQ-010.index.integration` |
| `REQ-011` | create route/panel | note file | create schema | `REQ-011.create.api` |
| `REQ-012` | move route/panel | note path | move schema | `REQ-012.move.api` |
| `REQ-013` | archive route/action | archive file | archive schema | `REQ-013.archive.api` |
| `REQ-014` | read route + `TextFileCodec` + preview/plain viewer | `NoteDocument` | note key/encoding/asset guard | `REQ-014.read.e2e` |
| `REQ-015` | CodeMirror source editor + markdown-commands toolbar (§4.6) | editor draft | pure transform unit suite | `REQ-015.markdown.e2e` |
| `REQ-016` | CodeMirror plain-text editor | editor draft | extension guard | `REQ-016.text.e2e` |
| `REQ-017` | autosave scheduler + write route | save state/version | content schema | `REQ-017.autosave.e2e` |
| `REQ-018` | SSE conflict detector + panel | conflict/source-missing state | expected version | `REQ-018.conflict.e2e` |
| `REQ-019` | read repository + read-only UI | oversized flag | 5 MiB cap | `REQ-019.oversized.e2e` |
| `REQ-020` | clipboard actions | current draft/rendered text | clipboard result | `REQ-020.copy.component` |
| `REQ-021` | settings/theme services | `ConfigV1` | appearance schema | `REQ-021.appearance.e2e` |
| `REQ-022` | workspace settings panel | canonical workspace | read-only contract | `REQ-022.workspace.component` |
| `REQ-023` | `AtomicFileWriter` | temp/target files | expected version | `REQ-023.atomic.integration` |
| `REQ-024` | metadata/index cache services | cache v1 files | cache schemas | `REQ-024.cache.integration` |
| `REQ-025` | logging/retention services | JSON logs | log field allowlist | `REQ-025.logs.integration` |
| `REQ-026` | package/network guard tests | none | outbound-request detector | `REQ-026.offline.e2e` |
| `REQ-027` | server/path security modules | canonical roots | host/origin/path checks | `REQ-027.boundary.security` |
| `REQ-028` | Markdown render/sanitize/asset pipeline | sanitized HTML | sanitizer policy | `REQ-028.xss.security` |
| `REQ-029` | Fastify schemas/body/rate limits | API DTOs | Zod + body limit | `REQ-029.validation.api` |
| `REQ-030` | UI primitives/accessibility layer | focus/ARIA state | axe + keyboard suite | `REQ-030.a11y.e2e` |
| `REQ-031` | virtualizer/worker/cache/perf harness | benchmark evidence | performance budgets | `REQ-031.performance` |
| `REQ-032` | plain-file/atomic/config migration | note/config files | durability suite | `REQ-032.compatibility.integration` |
| `REQ-033` | no-audit architecture + local ops logs | no behavioral store | repository scan | `REQ-033.auditability.test` |
| `REQ-034` | `<PaneDivider>` + AppShell layout state (§4.10) | `ConfigV1` pane fields | settings schema (§2.7) | `REQ-034.panes.e2e` |
| `REQ-035` | `<FindInNoteBar>` + CodeMirror decorations / preview highlights (§4.11) | editor draft (in-memory, no persisted model) | none (client-only) | `REQ-035.find.e2e` |
| `REQ-036` | copy-blocks pre-pass + copy-mounts affordance (§4.6, §4.12) | sanitized `<copy>` HTML in note content | sanitizer allowlist (§4.6) | `REQ-036.copymark.e2e` |
| `REQ-037` | AppShell focus layout + workspace UI state (§4.5) | `layout: WorkspaceLayout` (UI state only, route reset) | layout state machine | `REQ-037.focus.e2e` |
| `REQ-038` | recent scope on notes route + library row (§4.13) | `NoteMetadata` page | list query schema | `notes-routes.spec` recent cases |
| `REQ-039` | archive repository + `<ArchiveNoteView>` + restore (§4.13) | archive-tree `NoteMetadata`/`NoteDocument` | restore schema + path guard | `archive-routes.spec` |
| `REQ-040` | `NoteMutationService.deleteArchived` + trash (§4.13) | archived file -> OS recycle bin | confirmation + path guard | `archive-routes.spec` + `note-mutations.spec` |
| `REQ-041` | `<SourceEditor>` contentAttributes spellcheck wiring (§4.6) | editor draft (browser-owned dictionary) | none (client-only, attribute contract) | `source-spellcheck.spec` |

### 9.2 Screens

| Source | Route/surface | Component | Data source | State test |
|---|---|---|---|---|
| `SCREEN-001` | `/` | `DashboardPage` | notes/search/folders/SSE | `SCREEN-001.states.e2e` |
| `SCREEN-002` | `/notes/:noteKey` | `NoteWorkspacePage` | note/render/assets/SSE | `SCREEN-002.states.e2e` |
| `SCREEN-003` | `/settings` | `SettingsPage` | settings API | `SCREEN-003.states.e2e` |
| `SCREEN-004` | CLI | `WorkspaceLockPresenter` | lock service | `SCREEN-004.lock.e2e` |
| `SCREEN-005` | CLI or startup error | `StartupErrorPresenter` | startup errors | `SCREEN-005.startup.e2e` |
| `SCREEN-006` | conflict panel | `ConflictPanel` | editor store/note API | `SCREEN-006.conflict.e2e` |
| `SCREEN-007` | `/recovery/search` | `SearchRecoveryPage` | search API/SSE | `SCREEN-007.recovery.e2e` |
| `SCREEN-008` | `/archive/:noteKey` | `ArchiveNoteView` | archive APIs | `archive-note-view.spec` |

### 9.3 Workflows

| Source | Implementation | Permission | Audit | Rate limit | Test |
|---|---|---|---|---|---|
| `WF-001` | discovery + virtual list | Local Operator | none | reads | `WF-001.discovery.spec` |
| `WF-002` | search command/results | Local Operator | none | search | `WF-002.search.spec` |
| `WF-003` | create panel/API | Local Operator | none | mutations | `WF-003.create.spec` |
| `WF-004` | sort toolbar | Local Operator | none | mutations | `WF-004.preferences.spec` |
| `WF-005` | open workspace | Local Operator | none | reads | `WF-005.open.spec` |
| `WF-006` | editor autosave | Local Operator | none | mutations | `WF-006.autosave.spec` |
| `WF-007` | conflict resolution | Local Operator | none | mutations | `WF-007.conflict.spec` |
| `WF-008` | move note | Local Operator | none | mutations | `WF-008.move.spec` |
| `WF-009` | archive note | Local Operator | none | mutations | `WF-009.archive.spec` |
| `WF-010` | settings update | Local Operator | none | mutations | `WF-010.settings.spec` |
| `WF-011` | search rebuild | Local Operator | none | rebuild | `WF-011.rebuild.spec` |
| `WF-012` | pane resize/collapse controller (§4.10) | Local Operator | none | mutations (settings `PUT`) | `WF-012.panes.spec` |
| `WF-013` | find-in-note controller (§4.11) | Local Operator | none | none (client-only) | `WF-013.find.spec` |
| `WF-014` | archive restore panel (§4.13) | Local Operator | none | mutations | `archive-routes.spec` |
| `WF-015` | archive delete confirm (§4.13) | Local Operator | none | mutations | `archive-routes.spec` |

### 9.4 Metrics

| Source | Event | Emission point | Payload | Pass condition | Destination |
|---|---|---|---|---|---|
| `METRIC-001` | `metric.launch.ready` | package E2E harness | duration, OS, Node major, result | launch succeeds at fixed URL | local test JSON/JUnit |
| `METRIC-002` | `metric.startup.interactive` | frontend bootstrap mark | duration, fixture ID, result | p95 <2 s | local performance report |
| `METRIC-003` | `metric.search.response` | search benchmark | duration, query class, result count | p95 <100 ms | local performance report |
| `METRIC-004` | `metric.filesystem.integrity` | integrity suite | case ID, result, resulting hashes | all pass; no silent loss | local test JSON/JUnit |
| `METRIC-005` | `metric.accessibility.core` | axe/keyboard suite | screen ID, viewport, violation counts | no critical/serious; keyboard pass | local accessibility report |
| `METRIC-006` | `metric.offline.workflow` | network-disabled E2E | workflow ID, request violations, result | all pass; zero non-loopback requests | local test JSON/JUnit |

## 10. Implementation Gates

- Step 11: scaffold only after MasterPrompt approval and security/design gates.
- Step 12: pin Node/dependency majors; create ADRs for stack, local security/rate limit, and desktop-only viewport deviations.
- Step 14 before editor build: compile-check CodeMirror and Orama `save`/`load` APIs against pinned versions.
- Step 14 before preview build: sanitizer corpus includes OWASP-style XSS, SVG-as-image, malicious links, and path escapes.
- Step 15: package tarball test, three-OS matrix, network-disabled E2E, 10,000-note performance, atomic fault injection.

## 11. Verified External API Notes

- Fastify supports explicit `host: "127.0.0.1"` and route/global integer `bodyLimit`.
- Vite supports traditional backend integration and production manifest/static output.
- `trash` moves paths to the per-OS recycle bin (Windows/macOS/Linux) with bundled helper binaries; no network access.
- Node worker threads are stable for CPU-intensive indexing.
- Orama supports Node runtime, fuzzy/full-text search, mutation, and serializable index data.
