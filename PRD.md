# Local-Notes Product Requirements

Status: Approved product source  
Concept source: `project prompt.txt`  
Release: MVP

## 1. Product Overview

Local-Notes is a single-user, local-first note management and knowledge workspace. It runs entirely on the user's computer, opens in a browser, stores notes as human-readable files, and requires no internet connection during launch or use after package installation. It requires no account, cloud service, telemetry, analytics, or external API.

The filesystem is the sole source of truth. MVP supports `.md` and `.txt` notes under one local workspace. Product experience combines fast note discovery, focused editing, rendered Markdown reading, split preview, and safe interaction with files changed by other applications.

### Target User

- Individual maintaining personal or professional notes on one computer.
- User values offline access, file ownership, predictable behavior, and interoperability with ordinary text editors.

### MVP Boundary

- Included: note discovery, creation, reading, editing, autosave, search, sorting, archive, single-note move, settings, external file change detection, and safe file operations.
- Deferred: backups, imports, exports, templates, analytics dashboard, bulk operations, executable plugins, folder management, tags explorer, daily notes, saved searches, backlinks, wiki links, knowledge graph, multi-workspace support, advanced themes, and local AI extensions.

## 2. Business Goals and Success Metrics

No product metric may be transmitted or retained as telemetry. Metrics below are release acceptance measurements executed locally.

| ID | Goal | Measurement | MVP target |
|---|---|---|---|
| `METRIC-001` | One-command local launch | Automated launch acceptance test with package locally available | Application becomes usable at `http://127.0.0.1:8989` after `npx local-notes` |
| `METRIC-002` | Fast startup | Local benchmark from process start until dashboard interactive with warm metadata cache | p95 under 2 seconds |
| `METRIC-003` | Fast note discovery | Local benchmark against 10,000 indexed notes | p95 search response under 100 ms |
| `METRIC-004` | Reliable ownership | Filesystem acceptance suite covering create, edit, move, archive, crash-safe write, and external edit conflict | 100% pass; no silent content loss |
| `METRIC-005` | Accessible core workflow | Automated accessibility checks plus keyboard-only acceptance suite | No critical or serious automated violations; all MVP workflows keyboard operable |
| `METRIC-006` | Offline independence | Network-disabled end-to-end suite | 100% MVP workflows pass without internet access |

## 3. User Roles and Permissions

### Local Operator

- Sole product role.
- May access notes and settings inside active workspace.
- May create, read, edit, move, search, sort, copy, and archive supported notes.
- May browse archived notes read-only, restore an archived note into an existing folder, and delete an archived note to the operating-system recycle bin (`REQ-039`, `REQ-040`, ADR-009).
- May choose only existing folders inside active workspace.
- Cannot access paths outside active workspace through product UI or local API.
- Cannot delete active notes; archive is the only removal path for active notes. Application itself never permanently deletes note content - delete hands archived files to the OS recycle bin, recoverable outside the application.
- Has no account, authentication flow, remote session, sharing permission, or administrative role.

### Local Process

- System actor, not human role.
- May scan, index, watch, read, and safely write supported files inside active workspace.
- May read and update versioned local configuration, metadata cache, logs, and workspace lock.
- Cannot execute note content or access files outside allowed Local-Notes paths.

## 4. Functional Requirements

### 4.1 Launch and Workspace

#### `REQ-001` One-command launch

- User starts application with `npx local-notes` after a one-time package install.
- Package acquisition (ADR-007): download the release tarball from the project's GitHub Release page and install it once with `npm install -g`; acquisition may require internet access.
- After package is available locally, application launch and every product workflow function without internet access.
- Application starts one local process, opens default browser, and serves UI at `http://127.0.0.1:8989`.
- Each launch creates one ephemeral local access capability for browser-to-server requests.
- Capability is removed from address bar after bootstrap and is not persisted across browser or process restarts.
- Application remains usable with network access disabled.

Acceptance:

- Given supported OS, Node.js Active LTS at package release, and package available locally, when user runs launch command, then dashboard becomes available at specified loopback URL.
- Given package is not available locally and npm cannot be reached, launch reports package acquisition failure; this does not weaken offline requirements after installation.
- Given browser cannot open automatically, application remains running and displays local URL in terminal.
- Given browser session lacks current capability, workspace data remains inaccessible and UI offers secure relaunch instruction.
- Given port `8989` is unavailable, launch fails without selecting a different port and reports blocking process details when available plus instruction to free port and retry.

#### `REQ-002` Workspace initialization

- Default application root is `~/.local-notes/`.
- First launch creates required workspace directories and versioned configuration without deleting existing content.
- Active notes root is `~/.local-notes/save-data/notes/`.
- Archive root is `~/.local-notes/save-data/archive/`.
- Configuration corruption or unsupported version blocks unsafe startup and identifies affected file.

Acceptance:

- Given application root does not exist, first launch creates valid empty workspace.
- Given valid existing workspace, launch preserves all files.
- Given initialization fails, application reports failure and does not leave partially initialized workspace.

#### `REQ-003` Single-instance workspace lock

- Only one Local-Notes process may control workspace at a time.
- Second process displays `Workspace already in use.` and does not modify workspace.
- Stale lock recovery requires confirming owning process is no longer active.

Acceptance:

- Given active instance owns workspace, when second instance starts, then second instance exits without writes.
- Given stale lock with no active owner, when application starts, then lock is recovered and startup continues.

#### `REQ-004` Supported platforms

- MVP supports Windows 11.
- MVP supports current and immediately previous macOS major versions at release.
- MVP supports current Ubuntu LTS at release.
- Paths, filename checks, launch behavior, locks, and atomic file operations behave consistently across supported platforms.

Acceptance:

- Platform acceptance suite passes on every supported platform before release.

### 4.2 Note Discovery and Listing

#### `REQ-005` Recursive note discovery

- Application recursively discovers `.md` and `.txt` files under active notes root.
- Unsupported files and files outside notes root do not appear.
- Discovery handles at least 10,000 supported notes.
- Empty workspace displays clear create-note action.

Acceptance:

- Given nested supported files, dashboard lists each file once with title, folder, created time when available, modified time, and size.
- Given unsupported or inaccessible file, application skips it, records local diagnostic, and continues.
- Given no notes, dashboard shows empty state without error.

#### `REQ-006` Automatic filesystem refresh

- Create, update, rename, and delete changes made by other applications refresh note list and search results without restart.
- Burst changes are coalesced without losing final state.

Acceptance:

- Given external supported-file change, dashboard and search reflect final filesystem state within 2 seconds.
- Given temporary or repeated watcher event, application does not create duplicate note entries.

#### `REQ-007` List view

- Dashboard presents notes as a single list view (card view removed in feedback round 2).
- List view shows title, folder, created time or `Unknown`, modified time, and size.
- Lists use incremental rendering and remain navigable with 10,000 notes.

Acceptance:

- Empty, loading, and recoverable error states are distinguishable.

#### `REQ-008` Sorting

- User may sort by name, created date, modified date, or size.
- Each sort supports ascending and descending order.
- Missing created time displays `Unknown` and sorts after known values in both directions.
- Modified time never substitutes for missing created time.
- Sort choice persists locally.

Acceptance:

- Given same note set, repeated sort produces stable deterministic order.

### 4.3 Search

#### `REQ-009` Full-text search

- Search covers note title, filename, and content.
- Search supports exact, partial, and typo-tolerant matches.
- Ranking priority: exact title, partial title, exact content, partial content.
- Results show highlighted match and content snippet capped at 180 characters, centered around first highest-ranked match.
- Search updates while typing and supports `Ctrl+K` and `Ctrl+P`.
- Blank query returns current sorted note collection.
- Search initially exposes first 200 ranked results.
- `Load more` appends results in batches of 200 while preserving query, selection, and scroll position.

Acceptance:

- Given query `strtup` and note containing `startup`, result appears.
- Given matching title and matching content in different notes, title match ranks first.
- Given no match, search shows no-results state and preserves query.
- Search benchmark satisfies `METRIC-003`.

#### `REQ-010` Incremental search freshness

- New, changed, moved, archived, and externally modified notes update search incrementally.
- Full rebuild occurs only through explicit recovery action after index validation failure.
- Search never blocks note editing or dashboard interaction.
- Aggregate indexed content is capped at 512 MiB.
- Index prioritizes smaller notes first; once budget is exhausted, remaining notes retain title, filename, path, type, modified date, and size indexing but omit content indexing.
- Metadata-only results display `Content not indexed: memory budget`.

Acceptance:

- Given one changed note, only affected index entry changes.
- Given invalid index, application reports degraded search state and offers rebuild.
- Given aggregate content above budget, search remains available and labels metadata-only notes without exceeding budget.

### 4.4 Note Creation and File Management

#### `REQ-011` Create note

- User creates `.md` or `.txt` note in selected existing folder.
- Filename is required, trimmed, and limited to 120 characters including extension.
- Filename must use selected supported extension and exclude platform-invalid characters, reserved names, path separators, trailing dots, and trailing spaces.
- Resolved target path must remain within active workspace and pass platform acceptance tests for supported operating system path limits.
- Collision check is case-insensitive within target folder.
- Collision is rejected; application never auto-suffixes filename.
- New `.md` and `.txt` notes start empty.
- New files use UTF-8 without BOM and `LF` line endings.

Acceptance:

- Given valid unique filename and existing folder, note is created and opened.
- Given collision, invalid filename, overlong resolved path, missing folder, or path outside workspace, no file is created and error identifies rejected condition.

#### `REQ-012` Move one note

- User may move one note to selected existing folder inside notes root.
- Destination collision is rejected case-insensitively.
- Folder create, rename, delete, and bulk move are unavailable in MVP.

Acceptance:

- Given valid destination, note path updates without content change and search remains current.
- Given collision or inaccessible destination, original note remains unchanged.

#### `REQ-013` Archive note

- Dashboard and note workspace provide archive action.
- Archive moves note into workspace archive area while preserving relative source folder structure.
- Permanent deletion is unavailable in MVP.
- Archive collision is rejected and original remains unchanged.
- Collision state offers `Rename then archive`; rename uses `REQ-011` validation.
- Archive never overwrites existing file or generates automatic suffix.

Acceptance:

- Given valid note, archive removes it from active collection and preserves content in archive.
- Given archive collision, existing archived file and active note remain unchanged until user completes valid rename.
- Given other archive failure, note remains active and user receives recoverable error.

### 4.5 Note Workspace

#### `REQ-014` Open and read supported note

- Opening note displays current filesystem content and note identity.
- Supported text encoding is UTF-8 with or without BOM.
- Existing UTF-8 BOM and consistent `LF` or `CRLF` line endings are preserved on save.
- Invalid UTF-8 files remain discoverable and open read-only with `Unsupported encoding`.
- `.md` read mode renders headings, lists, tables, task lists, links, images, code blocks, and block quotes.
- Images render only from workspace-relative local paths.
- Remote URLs, `file://` URLs, data URLs, and image paths escaping workspace show blocked-image placeholder.
- Workspace-relative note and file links open inside Local-Notes when target is allowed and supported.
- `http` and `https` links require explicit confirmation before opening in default browser.
- All other URI schemes are blocked.
- Rendered content cannot execute scripts or embedded JavaScript.
- `.txt` displays literal plain text without Markdown rendering.

Acceptance:

- Given valid note, displayed content matches filesystem source.
- Given UTF-8 BOM or existing consistent line-ending style, edit/save preserves both.
- Given invalid UTF-8, application never rewrites file and displays read-only encoding warning.
- Given blocked image source, no resource loads and placeholder identifies blocked image.
- Given external web link, no network navigation occurs before user confirmation.
- Given blocked link scheme or workspace-escape target, application does not open target.
- Given missing or unreadable note, workspace preserves current editor content and offers `Retry` plus `Back to dashboard`.

#### `REQ-015` Markdown editing

- `.md` supports read, source, and split modes (feedback round 2, ADR-008: dedicated visual editor removed; source is the single editing surface).
- Source mode provides a formatting toolbar whose controls rewrite Markdown syntax at the selection: bold, italic, underline, strike-through, copyable-text mark, headings H1-H3, bullet lists, numbered lists, task lists, links, tables, code blocks, undo, and redo.
- Toolbar operations are ordinary undoable text edits; the document remains plain Markdown at all times.
- Underline serializes as sanitized `<u>` HTML.
- Split mode supports side-by-side, preview above, and preview below with a draggable divider.
- Saved file remains Markdown text without proprietary format.

Acceptance:

- Toolbar operation produces equivalent Markdown syntax at the selection and is undoable.
- Switching modes does not alter content.
- Live preview reflects current draft without executing note content.

#### `REQ-016` Plain-text editing

- `.txt` uses plain-text editor.
- Markdown preview and formatting controls are unavailable.
- Saved file preserves literal text and line breaks.

Acceptance:

- Given Markdown syntax in `.txt`, application displays and saves syntax literally.

#### `REQ-017` Autosave

- Modified editable note autosaves after 750 ms without further input.
- Save status exposes `Unsaved`, `Saving`, `Saved`, `Conflict`, and `Error`.
- Navigation with pending save waits for completion or asks user to stay/discard when save cannot complete.
- No manual save button is required.

Acceptance:

- Given valid edit, filesystem reflects draft after debounce and status becomes `Saved`.
- Given save failure, draft remains in memory, status becomes `Error`, and retry is available.
- Closing browser tab with unsaved or failed draft triggers browser-supported warning.

#### `REQ-018` External modification conflict

- Application tracks filesystem version loaded into editor.
- External modification while local draft is dirty pauses autosave and preserves draft.
- Conflict state requires explicit `Reload disk version` or `Overwrite with draft`.
- Reload replaces draft only after explicit confirmation.
- Overwrite uses safe write and records new filesystem version.
- External rename of clean open note follows new path automatically.
- External rename or deletion while draft is dirty pauses autosave, preserves draft, marks source missing, and offers `Save as new note` or `Close without saving`.
- `Save as new note` uses standard create validation and never silently recreates stale path.

Acceptance:

- Given dirty draft and external change, neither version is silently lost.
- Given reload choice, disk version appears.
- Given overwrite choice, preserved draft becomes file content.
- Given clean note renamed externally, editor identity updates to new path without content loss.
- Given dirty note renamed or deleted externally, no file is created until user selects and completes `Save as new note`.

#### `REQ-019` Oversized note handling

- Files above 5 MiB remain discoverable.
- Oversized files open read-only with size warning.
- Search indexes at most first 5 MiB and labels matching result as truncated.
- Editing, autosave, and overwrite actions are unavailable.

Acceptance:

- Given file above cap, application does not load it into editable editor and never truncates file on disk.

#### `REQ-020` Copy actions

- Markdown note provides `Copy Markdown` and `Copy Text`.
- `Copy Markdown` copies source.
- `Copy Text` copies readable plain text with Markdown syntax removed.
- Plain-text note provides `Copy Text` only.

Acceptance:

- Copy success and clipboard-denied failure receive clear feedback.

#### `REQ-037` Focus mode

Applies to every supported note type (`.md` and `.txt`); moved from `REQ-015` per ADR-005 finding.

- Note workspace provides focus mode that expands note content to full application window, hides titlebar, folder navigation, and note list, and preserves note title, editor modes, note actions, conflict state, and status.
- Focus mode is available through visible editor-toolbar toggle and `Ctrl+Shift+F`; `Escape` restores full workspace layout.
- Focus mode is UI state only: route change or reload restores standard workspace layout (`MasterPrompt.md` §4.5, `Design_System.md` §12).

Acceptance:

- Entering and leaving focus mode does not alter draft, selection, scroll position, editor mode, or save state.
- Focus mode retains all note-specific tools and conflict-resolution actions without page-level horizontal overflow at supported viewports.
- Given route change or application reload, workspace returns to standard layout.

### 4.6 Settings

#### `REQ-021` Appearance settings

- User may select light, dark, or system theme.
- Default theme is system.
- Dark theme is primary visual direction: low-glare, restrained, native desktop-tool appearance.
- System theme follows operating system preference without restart.
- User may set editor font size from 12 through 24 px.
- Default editor font size is 14 px.
- User may set line height from 1.2 through 2.0.
- Default line height is 1.6.
- User may set editor width to narrow, medium, wide, or full; full removes the width cap so editor and preview fill the pane (feedback round 2).
- Default editor width is medium.
- Settings validate before persistence and apply without restart.

Acceptance:

- Valid setting persists across restart.
- Invalid or corrupt setting falls back to exact defaults above and identifies affected setting.

#### `REQ-022` Workspace settings

- Settings displays active workspace path as read-only in MVP.
- Templates and attachments paths are deferred with corresponding controls absent.
- Multi-workspace switching is unavailable.

Acceptance:

- User can inspect canonical active workspace path but cannot redirect application through MVP UI.

### 4.7 File Integrity and Recovery

#### `REQ-023` Safe writes

- Every note and configuration write is atomic.
- Failed write never replaces last valid target with partial content.
- Temporary artifacts are cleaned on successful completion and safely recoverable after interruption.

Acceptance:

- Fault-injection tests at each write stage preserve either complete old content or complete new content.

#### `REQ-024` Metadata cache

- Local metadata cache may accelerate startup and discovery but is never source of truth.
- Cache mismatch or corruption triggers targeted refresh; unrecoverable mismatch triggers rebuild.
- Deleting cache cannot delete or change notes.

Acceptance:

- Given missing or corrupt cache, application rebuilds usable state from filesystem.

#### `REQ-025` Local diagnostics

- Application records bounded local operational logs for startup, file watching, indexing, and recoverable errors.
- Logs exclude note content and clipboard content.
- Logs retain up to 30 days or 100 MiB total, whichever limit is reached first.
- Rotation deletes oldest log files first.
- No log leaves user's computer.

Acceptance:

- Given recoverable filesystem error, log includes timestamp, operation, sanitized relative path, and error category without note content.
- Given either retention limit is exceeded, oldest logs are removed until both limits pass.

### 4.8 Workspace Layout and In-Note Search

#### `REQ-034` Resizable and collapsible workspace panes

- Folder navigation pane and note list pane widths are user-adjustable by dragging a divider.
- Divider is keyboard-operable: focus divider, use arrow keys to resize in fixed increments.
- Each pane may be collapsed to a compact rail and restored without losing prior width.
- Resize and collapse apply only at `desktop` breakpoint (`1280x720`) and above; at `desktop-min` (`1024x640`-`1199px`) panes use the fixed compact widths defined in `Design_System.md` and the divider is disabled.
- Pane width and collapsed state persist locally across restarts.
- Resizing never reduces the note workspace below its minimum usable width at the active breakpoint.
- If a width or collapse change fails to persist, the affected pane rolls back to its last-persisted value, matching the settings rollback behavior in `WF-010`.
- Folder pane width range is `190`-`280` px (default `220`); note list pane width range is `280`-`420` px (default `320`).

Acceptance:

- Given `desktop` breakpoint or above, dragging a divider resizes the adjacent pane within its bounds and persists after restart.
- Given `desktop-min` breakpoint, divider is present but disabled and panes remain at fixed compact widths.
- Given a pane is collapsed, when restored, prior width returns.
- Given resize would reduce note workspace below minimum usable width, resize stops at the boundary.

#### `REQ-035` Find in note

- Open note provides find-in-note across the currently loaded content, independent of dashboard search (`REQ-009`).
- Find highlights all matches in the active editor mode and shows current match position and total match count.
- User may step to next and previous match and close find without altering draft content.
- Find never triggers a filesystem read, write, or dashboard search request.
- Find is available in read, edit, source, and split modes; case-insensitive by default.
- Find remains available in Focus Mode alongside the note tools `REQ-037` already preserves there.
- Match highlighting is capped at `500` matches per note; total match count stays accurate beyond the cap.

Acceptance:

- Given an open note with matching text, all matches highlight and match count is accurate.
- Given no match, find shows no-match state and preserves query.
- Given user closes find, editor focus and draft content are unchanged.
- Given note has no loaded content yet, find is unavailable until content loads.

### 4.9 Copyable Text Snippets

#### `REQ-036` Copyable text mark

- `.md` supports a copyable-text mark, applied to a selection via the source-mode toolbar (`REQ-015`) or by typing `<copy>...</copy>` in source mode.
- Inline form: `<copy>text</copy>` inside a paragraph, including soft line breaks within that paragraph.
- Block form (feedback round 2): a line containing only `<copy>`, any Markdown content including blank lines, then a line containing only `</copy>`. Inner content renders as normal Markdown through the same sanitization pipeline.
- Marked content renders in read and split preview with a visible copy affordance button immediately after the mark, and the marked region itself is click-to-copy: clicking anywhere in the rendered mark copies it (links inside still navigate per `REQ-014`).
- Copying preserves line structure: block children separate with line breaks, table cells with tabs; nested Markdown syntax is stripped to plain text.
- Uses the same clipboard mechanism and failure handling as `Copy Text` (`REQ-020`).
- An empty mark copies an empty string; no error state.
- Mark serializes as sanitized `<copy>` HTML. Together with `<u>` (`REQ-015`), these are the only two raw HTML tags interpreted in saved Markdown source.
- `<copy>` lines inside fenced code blocks stay literal and never form a region.
- `.txt` notes do not interpret `<copy>`; literal `<copy>` text in a `.txt` file displays and saves as plain text with no affordance.
- The copy affordance never triggers a filesystem write, network request, or dashboard search.

Acceptance:

- Given selected text and toolbar activation, the mark applies as `<copy>...</copy>` in Markdown source.
- Given an inline or block mark in read or split preview, clicking the mark or its affordance copies plain text with Markdown syntax stripped, line structure preserved, and the same success/failure feedback as `Copy Text`.
- Given a block region containing active content (scripts, event handlers), sanitization strips it identically to normal rendering.
- Given `<copy>` text in a `.txt` file, content displays and saves literally with no affordance rendered.

### 4.10 Library Scopes and Archive Browser

#### `REQ-038` Recent scope

- Sidebar library provides a `Recent` row listing notes modified within the last 7 days, newest first by default.
- Recent count displays beside the row and derives from server metadata, never from a scoped page.
- Scope selection is session-only; sorting and search behave as in the unscoped list.

Acceptance:

- Given notes older and newer than 7 days, Recent lists only the newer set and the row count matches.
- Given no recent notes, Recent shows the standard empty state without error.

#### `REQ-039` Archive browser

- Sidebar library provides an `Archive` row listing archived notes from the archive area (`REQ-013`) with count.
- Archived notes open read-only; editing, autosave, and rename are unavailable. `.md` renders like read mode; `.txt` displays literal text.
- Archived note actions: `Move note` (restore into an existing active folder), `Copy Markdown` (`.md` only), `Copy Text`, `Copy local path`, `Delete` (`REQ-040`).
- Restore uses the same destination validation and collision rules as move (`REQ-012`); collision leaves both sides unchanged.
- Restored note returns to active discovery, search, and editing.

Acceptance:

- Given archived notes, Archive row lists each exactly once and opening one shows read-only content.
- Given restore into a folder with a case-fold name collision, restore is rejected and both files remain unchanged.
- Given successful restore, note opens editable from its new active path.

#### `REQ-040` Delete archived note to recycle bin

- Delete is available only for archived notes and only behind an explicit confirmation dialog naming the file.
- Delete moves the file to the operating-system recycle bin; the application never unlinks note content itself (deviation from original no-delete constraint recorded in ADR-009).
- Failed delete leaves the archived file unchanged and surfaces a recoverable error.
- Active notes have no delete action anywhere in the product.

Acceptance:

- Given confirmation, the archived file leaves the archive area and appears in the OS recycle bin.
- Given cancellation, nothing changes.
- Given delete failure, the archived note remains listed and readable.

## 5. Page / Screen Inventory

| ID | Surface | Purpose | Related requirements |
|---|---|---|---|
| `SCREEN-001` | Dashboard | Discover, search, sort, create, open, move, and archive notes; Recent and Archive library scopes | `REQ-005`-`REQ-013`, `REQ-034`, `REQ-038`, `REQ-039` |
| `SCREEN-002` | Note Workspace | Read, edit, preview, copy, move, and archive one note | `REQ-014`-`REQ-020`, `REQ-034`, `REQ-035`, `REQ-036`, `REQ-037` |
| `SCREEN-003` | Settings | Configure appearance and inspect active workspace | `REQ-021`, `REQ-022` |
| `SCREEN-004` | Workspace Lock Error | Explain active workspace ownership conflict | `REQ-003` |
| `SCREEN-005` | Startup Error | Report initialization, configuration, or port failure | `REQ-001`, `REQ-002` |
| `SCREEN-006` | External Change Conflict | Resolve disk-versus-draft conflict | `REQ-018` |
| `SCREEN-007` | Search Recovery | Explain degraded index and allow explicit rebuild | `REQ-010`, `REQ-024` |
| `SCREEN-008` | Archive Note View | Read one archived note; restore, copy, or delete it | `REQ-039`, `REQ-040` |

## 6. Dashboard Workflow Inventory

| ID | Workflow | Surface | State path | Permission | Empty/error/loading behavior | Pass condition |
|---|---|---|---|---|---|---|
| `WF-001` | Discover notes | `SCREEN-001` | loading -> populated or empty | Local Operator | Skeleton; empty create action; partial filesystem errors remain visible | Active supported notes appear once |
| `WF-002` | Search notes | `SCREEN-001` | idle -> searching -> results/no results/error | Local Operator | Query retained on no result/error; degraded index links recovery | Ranking, snippets, cap, latency pass |
| `WF-003` | Create note | `SCREEN-001` | dialog -> validating -> created/error | Local Operator | Invalid fields remain editable; no partial file | Unique valid note opens |
| `WF-004` | Sort notes | `SCREEN-001` | current -> updated | Local Operator | Empty state preserves controls | Stable order and persisted preference |
| `WF-005` | Open note | `SCREEN-001`, `SCREEN-002` | loading -> readable/editable/read-only/error | Local Operator | Missing/unreadable/oversized states distinct | Correct source displayed |
| `WF-006` | Edit and autosave | `SCREEN-002` | saved -> unsaved -> saving -> saved/error/conflict | Local Operator | Draft retained on failure | Atomic persisted content matches draft |
| `WF-007` | Resolve conflict | `SCREEN-006` | conflict -> reload or overwrite -> resolved/error | Local Operator | Both versions preserved until explicit choice succeeds | Chosen version becomes editor and disk state |
| `WF-008` | Move note | `SCREEN-001`, `SCREEN-002` | choose folder -> validating -> moved/error | Local Operator | Collision leaves source unchanged | Path changes; content unchanged |
| `WF-009` | Archive note | `SCREEN-001`, `SCREEN-002` | confirm -> archiving -> archived/error | Local Operator | Failure leaves active note unchanged | Note moves to archive and leaves active results |
| `WF-010` | Change settings | `SCREEN-003` | current -> validating -> applied/error | Local Operator | Invalid value identifies correction | Valid choice applies and persists |
| `WF-011` | Rebuild search | `SCREEN-007` | degraded -> rebuilding -> ready/error | Local Operator | Editing remains available during rebuild | Index matches filesystem |
| `WF-012` | Resize and collapse panes | `SCREEN-001`, `SCREEN-002` | standard -> resizing/collapsed -> persisted | Local Operator | Divider disabled below `desktop` breakpoint; collapse preserves prior width | Width/collapsed state persists across restart |
| `WF-013` | Find in note | `SCREEN-002` | idle -> searching -> match/no-match -> closed | Local Operator | No-match preserves query; unavailable before content loads | Matches highlight accurately; draft unchanged on close |
| `WF-014` | Restore archived note | `SCREEN-008` | choose folder -> validating -> restored/error | Local Operator | Collision leaves both sides unchanged | Note returns to active tree and opens editable |
| `WF-015` | Delete archived note | `SCREEN-008` | confirm -> deleting -> deleted/error | Local Operator | Cancel changes nothing; failure leaves note listed | File reaches OS recycle bin and leaves archive list |

## 7. Non-Functional Requirements

### `REQ-026` Offline and privacy

- All MVP launches and workflows function without internet after package installation.
- Application makes no outbound network request.
- No accounts, telemetry, analytics collection, tracking, advertisements, cloud synchronization, or external APIs.
- Local acceptance measurement is not retained as user analytics.

Acceptance:

- Network-disabled launch and end-to-end suite passes with package available locally.
- Outbound-request test detects zero non-loopback requests.

### `REQ-027` Workspace boundary security

- Every user-controlled path is treated as untrusted.
- File operations are restricted to active workspace and required Local-Notes application directories.
- Symbolic links, junctions, traversal sequences, encoded separators, and case variants cannot escape allowed boundary.
- Local server binds only to `127.0.0.1` and accepts mutation requests only from origin `http://127.0.0.1:8989`.
- Every API, event-stream, and asset request requires current per-launch 256-bit capability.
- Capability exists only in process memory and browser session storage, never configuration, logs, query parameters, or persistent cache.

Acceptance:

- Boundary security suite rejects traversal and link-escape attempts without touching external targets.
- Missing, stale, or incorrect capability receives `401` without revealing workspace data.

### `REQ-028` Content safety

- Note content is data, never executable code.
- Rendered Markdown sanitizes unsafe HTML, scriptable URLs, event handlers, and embedded JavaScript.
- External resources never load automatically.
- Markdown images follow `REQ-014` workspace-relative policy.

Acceptance:

- XSS corpus produces no script execution or unauthorized request.

### `REQ-029` Request validation and resilience

- All local API inputs are validated.
- Request body maximum is 8 MiB to accommodate 5 MiB note plus bounded encoding and metadata overhead.
- Mutation requests reject malformed, oversized, cross-origin, or out-of-workspace input.
- Repeated malformed requests cannot starve normal local UI requests.

Acceptance:

- Invalid-input suite returns bounded errors without process crash or filesystem mutation.

### `REQ-030` Accessibility

- MVP targets WCAG 2.1 AA.
- Core workflows support keyboard navigation, visible focus, screen readers, semantic labels, sufficient contrast, and 200% zoom within supported viewport contract.
- Desktop controls follow native-tool density while remaining keyboard and pointer operable.
- Reduced-motion preference disables nonessential transitions.
- Color is never sole state indicator.

Acceptance:

- `METRIC-005` passes at `1024x640`, `1280x720`, and `1440x900`.

### `REQ-031` Performance and capacity

- Startup p95 under 2 seconds with warm metadata cache.
- Search p95 under 100 ms across 10,000 notes.
- Dashboard supports 10,000 notes with incremental rendering.
- Search and indexing do not block typing, navigation, or autosave.
- Application memory usage remains bounded by visible/editor state and index size rather than loading every full note into UI.
- Supported minimum viewport is `1024x640`.
- Product is optimized for `1280x720` and `1440x900`.
- Viewports below supported minimum show resize guidance; complete workflow usability below minimum is out of scope.
- Mobile phones and tablets are unsupported for MVP.

Acceptance:

- `METRIC-002` and `METRIC-003` pass on documented release reference hardware.
- 30-minute edit/search/file-change soak test has no unbounded memory growth.
- Supported viewport suite has no clipped core actions, overlapping panels, or unintended page-level horizontal scrolling.

### `REQ-032` Compatibility and data durability

- Stored notes remain ordinary `.md` and `.txt` files readable without Local-Notes.
- Application does not add proprietary content wrappers.
- Unexpected shutdown cannot produce partially written target note.
- Configuration changes are versioned and migration failures preserve previous valid configuration.

Acceptance:

- Notes edited by Local-Notes open correctly in ordinary text editors.
- Crash-recovery and configuration-migration suites pass.

### `REQ-033` Product auditability

- MVP does not maintain behavioral analytics or user activity audit trail.
- Filesystem timestamps, current files, archive files, and bounded operational logs provide local operational evidence.
- Application never permanently deletes note content; delete moves archived files to the OS recycle bin (`REQ-040`), keeping destructive actions recoverable outside the product.

Acceptance:

- No product database or hidden activity history exists.
- Operational logs satisfy `REQ-025`.

## 8. Out of Scope

- Accounts, authentication, roles beyond Local Operator, sharing, collaboration, and remote access.
- Cloud sync, hosted deployment, domain, VPS, external APIs, telemetry, and analytics collection.
- Permanent (unrecoverable) in-app deletion; delete for active notes.
- Backups and restore UI.
- Import, export, and ZIP packaging.
- Templates and template folder controls.
- Analytics dashboard and writing statistics.
- Bulk rename, duplicate, move, archive, and export.
- Folder create, rename, and delete.
- Executable plugins and plugin marketplace.
- Tags explorer, daily notes, and saved searches.
- Backlinks, wiki links, knowledge graph, and note relationships.
- Multi-workspace support.
- `.markdown` and `.mdx`.
- Advanced themes and optional local AI extensions.
- Mobile and tablet layouts.
- Browser viewports below `1024x640`.

## 9. Concept Traceability

| Concept area | PRD coverage |
|---|---|
| Local launch and offline operation | `REQ-001`, `REQ-026` |
| Filesystem ownership and workspace | `REQ-002`, `REQ-005`, `REQ-023`, `REQ-032` |
| Single-instance locking | `REQ-003` |
| Dashboard discovery and sorting | `REQ-005`-`REQ-008` |
| Search and incremental indexing | `REQ-009`, `REQ-010` |
| Note management and archive | `REQ-011`-`REQ-013` |
| Markdown/plain-text workspace | `REQ-014`-`REQ-020` |
| Settings | `REQ-021`, `REQ-022` |
| Cache and diagnostics | `REQ-024`, `REQ-025` |
| Security, accessibility, performance | `REQ-027`-`REQ-031` |
| Workspace layout customization | `REQ-034` |
| In-note search | `REQ-035` |
| Copyable text snippets | `REQ-036` |
| Library scopes and archive browser | `REQ-038`-`REQ-040` |
| Future roadmap | Section 8 |
