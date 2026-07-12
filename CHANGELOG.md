# Changelog

All notable changes to this project will be documented in this file. Format follows Keep a Changelog; versions follow Semantic Versioning. Releases ship as GitHub Release tarballs per ADR-007.

## [Unreleased]

## [1.2.0] - 2026-07-12

### Changed

- Preview follows your line breaks: pressing Enter once in the source now shows as a new line in Read and Split preview instead of joining into one long paragraph - a blank line still starts a new paragraph, and Copy Text keeps the same line structure it always had
- Copy Markdown no longer includes the app's `<copy>` and `</copy>` markers: marked regions keep their content, lines that held only a tag disappear, and code blocks or inline code showing the tags as examples keep them literal
- Dependency vulnerability scanning now runs fully on the development machine: the previously firewalled Trivy database downloads again, and a fresh scan of all shipped dependencies found zero known vulnerabilities

## [1.1.0] - 2026-07-10

### Added

- Spellcheck while you type: misspelled words in the source editor now get the browser's familiar red wavy underline, and a right-click offers spelling suggestions - powered by your browser's own dictionary, fully offline, and applying a suggestion is a normal undoable edit; read-only notes stay quiet

## [1.0.0] - 2026-07-06

First release: the complete local notes workspace as an installable package.

### Added

- Markdown formatting toolbar in Source mode: bold, italic, underline, strike-through, copyable-text mark, headings, bullet/numbered/task lists, links, tables, code blocks, undo and redo - every control writes plain Markdown syntax at your selection as a normal undoable edit
- Recent in the sidebar: one click lists every note modified in the last 7 days, with a live count
- Archive browser: the Archive sidebar row lists archived notes; open one to read it, move it back into any folder, copy its content or local path, or delete it - Delete moves the file to the system Recycle Bin after an explicit confirmation, and the app itself never permanently erases a note
- Multi-line copyable regions: start a line with `<copy>` - alone, with content right after it, or even `<copy>## Heading</copy>` on a single line - and close with `</copy>` at the end of a line; everything between (headings, tables, lists, blank lines, code) renders as normal Markdown inside one highlighted region with a single copy control, and copying keeps the line and table structure
- Line wrap toggle in the formatting toolbar: switch soft wrapping off to inspect long lines with horizontal scrolling, and back on to wrap at the pane edge - a view preference for the current session that never changes the file
- Copy tags stand out in the source editor: literal `<copy>` and `</copy>` markers show in their own muted bronze color so copyable regions are easy to spot while editing
- Click-to-copy: in Read and Split preview, clicking anywhere on copy-marked text copies it - the copy button stays for discoverability and keyboard use
- Widescreen editing everywhere: the line-length cap and the editor width setting are gone - Read, Source, and Split always fill the pane, no blank column on wide displays
- Resizable split view: drag the new divider between editor and preview (or focus it and use arrow keys; double-click resets to half) in side-by-side and stacked layouts - no more fixed 50/50 squeeze

- Installable package: the app now builds into a single tarball that serves the full interface from the local server - download a release, `npm install -g` it once, and `npx local-notes` opens the complete app with no dev tooling; an automated acceptance test installs the package into a clean location and verifies launch, and tagged releases attach the tarball to a GitHub Release automatically
- Search runs on its own background thread in the installed app: typing and saving never wait on indexing, and if the search engine ever crashes the app restarts it once automatically - editing is unaffected and the search recovery screen still rebuilds the index on demand
- Sort notes your way: the dashboard sort selector now works - choose name, created, modified, or size, flip ascending/descending, and both choices persist across restarts
- Local diagnostics: the app now writes structured operational logs to ~/.local-notes/logs with 10 MiB file rotation and automatic cleanup (30 days / 100 MiB total, checked hourly) - note content, search queries, and access tokens never appear in a log
- Smooth dashboard at any size: the note list renders only the rows on screen, so a workspace with 10,000 notes scrolls without slowdown or memory growth

- Crash-safe file handling foundations: atomic note/config writes, workspace boundary protection, single-instance lock, first-run workspace creation, settings persistence with safe defaults, bounded local diagnostics
- Project scaffold: Vite/React/Tailwind frontend toolchain, CI, repo hygiene configs
- Quiet Workbench design system tokens ported to Tailwind theme
- Launch (first-run) screen with workspace chooser dialog and resize guidance
- Workspace shell screen: folder navigation, note list with search filter, split source/preview editor layout, focus mode, command palette, settings and create-note dialogs (mock data; real filesystem wiring pending)
- Note discovery: workspace scan with deterministic sort, metadata cache warm restarts, and live file watching that reflects external note changes in the open app within seconds
- Dashboard shows real workspace data: note list and folder tree with counts populate from disk, skeleton loading state, empty-workspace create prompt, and no-match search state
- Full-text search: typo-tolerant ranked search across titles, filenames, and content with highlighted snippets, 200-result batches, and live index updates when files change outside the app
- Search recovery screen: a degraded index shows a banner and a dedicated page to rebuild the search index while editing stays available
- Create, move, and archive notes: create into any existing folder with collision-safe validation, move a note between folders, and archive with folder structure preserved - a name clash in the archive offers rename-then-archive, and nothing is ever overwritten
- Live note editing: opening a note shows its real file content in a source editor with Markdown highlighting, changes autosave 750ms after the last keystroke, and the status bar shows saved/saving/conflict/error plus the file's encoding and line-ending style
- Draft protection: switching notes or leaving the editor saves a pending draft first; when a draft cannot be saved, a dialog asks whether to stay or discard - drafts are never dropped silently
- External change handling: a file edited outside the app while a draft is open shows a conflict panel preserving both versions, with reload requiring explicit confirmation; a file renamed or deleted outside the app offers "Save as new note" that carries the full draft into the new file
- Read-only protection: notes over 5 MiB and files that are not valid UTF-8 open read-only with a clear banner, and the file on disk is never truncated or rewritten
- Rendered Markdown preview: Read mode and a split view (side-by-side or stacked) render notes with tables and task lists through server-side sanitization; note links navigate inside the app, external links ask for confirmation before opening, and images load only from inside the workspace
- Copyable text: mark any span in a note so the rendered preview shows a one-click copy button next to it
- Copy actions: Copy Markdown (source), Copy Text (readable plain text with Markdown syntax removed), and Copy local path from the note actions menu, with clear success and failure feedback
- Find in note: Ctrl+F opens an in-note find bar in every mode (read, source, split) with live match highlighting, current position and total count, next/previous stepping, an optional match-case toggle, and Escape to close - all without touching the file or the dashboard search
- Rename tracking: a note renamed or moved outside the app while open with no unsaved changes now follows the new name automatically - the editor and address bar update silently and no content is lost; with unsaved changes the existing conflict panel preserves the draft
- Deleted-file notice: a note deleted outside the app while open now shows the conflict panel immediately (with "Save as new note" recovery) instead of silently keeping stale content until the next save
- Settings: theme (system/light/dark), editor font size, and line height apply instantly and persist across restarts; the settings dialog opens at /settings from the gear button, Ctrl+, or the command palette, shows the active workspace path, and identifies any invalid value without losing your other changes
- Dashboard sort preferences persist across restarts
- Resizable panes: drag the dividers to resize the folder and note-list panes (or focus a divider and use arrow keys; Home/End snap to the limits), collapse either pane to a slim rail and restore it at its prior width - all remembered across restarts
- Safer archiving: archiving a note you are editing now saves the pending draft first; if the draft cannot be saved, the archive stops with a clear error instead of losing the last edits

### Fixed

- Clicking a folder now shows that folder's notes: the selection previously did nothing - the list is now scoped on the server (correct totals and paging at any workspace size) and sidebar counts stay accurate while a folder is selected
- Pane resize and collapse now work at every supported window width: the dividers were disabled below 1280 CSS pixels, which display scaling made common on ordinary monitors
- Sort direction now re-orders the note list immediately: previously the ascending/descending toggle saved the preference but the visible order never changed until a restart
- Screen readers now announce the note editor by name: the editing surface itself carried no accessible label, so assistive technology announced an unnamed text field
- Markdown syntax coloring in the source editor: headings and their # marks now show in the amber syntax accent, inline code and links get their own colors in both themes - previously everything rendered in the plain text color; the light-theme syntax accent is contrast-tuned for the code surface
- Notes are no longer rewritten on disk without an edit: opening a note or applying settings while one was open could silently save the file (sometimes with normalized whitespace) - the editor now saves only real edits
- Opening Settings no longer disturbs the note you were editing: the note stays open behind the dialog and applying returns you to it

### Changed

- Editor modes simplified to Read, Source, and Split: the separate rich-text Edit mode and its compatibility checks are gone - every note edits as plain Markdown with the new formatting toolbar, so no note can ever be refused for editing again
- Dashboard is list-only: the card view and its toggle were removed
- Search is much faster in large workspaces: typo-tolerant matching now runs as a rescue pass only when a query has no exact hits, cutting worst-case search time from ~280ms to under 60ms across 10,000 notes - misspelled searches still find their notes
- Light theme ships: choosing Light (or System on a light-mode OS) now applies the warm-paper palette instantly - every color pair contrast-verified for readability
