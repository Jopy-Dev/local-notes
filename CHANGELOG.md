# Changelog

All notable changes to this project will be documented in this file. Format follows Keep a Changelog; versions follow Semantic Versioning. First release after the initial npm publish will be `1.0.0`.

## [Unreleased]

### Added

- Installable package: the app now builds into a single tarball that serves the full interface from the local server - download a release, `npm install -g` it once, and `npx local-notes` opens the complete app with no dev tooling; an automated acceptance test installs the package into a clean location and verifies launch, and tagged releases attach the tarball to a GitHub Release automatically
- Search runs on its own background thread in the installed app: typing and saving never wait on indexing, and if the search engine ever crashes the app restarts it once automatically - editing is unaffected and the search recovery screen still rebuilds the index on demand

- Crash-safe file handling foundations: atomic note/config writes, workspace boundary protection, single-instance lock, first-run workspace creation, settings persistence with safe defaults, bounded local diagnostics
- Project scaffold: Vite/React/Tailwind frontend toolchain, CI, repo hygiene configs
- Quiet Workbench design system tokens ported to Tailwind theme
- Launch (first-run) screen with workspace chooser dialog and resize guidance
- Workspace shell screen: folder navigation, note list with search filter, split source/preview editor layout, focus mode, command palette, settings and create-note dialogs (mock data; real filesystem wiring pending)
- Note discovery: workspace scan with deterministic sort, metadata cache warm restarts, and live file watching that reflects external note changes in the open app within seconds
- Dashboard shows real workspace data: note list and folder tree with counts populate from disk, list/card view toggle, skeleton loading state, empty-workspace create prompt, and no-match search state
- Full-text search: typo-tolerant ranked search across titles, filenames, and content with highlighted snippets, 200-result batches, and live index updates when files change outside the app
- Search recovery screen: a degraded index shows a banner and a dedicated page to rebuild the search index while editing stays available
- Create, move, and archive notes: create into any existing folder with collision-safe validation, move a note between folders, and archive with folder structure preserved - a name clash in the archive offers rename-then-archive, and nothing is ever overwritten or deleted
- Live note editing: opening a note shows its real file content in a source editor with Markdown highlighting, changes autosave 750ms after the last keystroke, and the status bar shows saved/saving/conflict/error plus the file's encoding and line-ending style
- Draft protection: switching notes or leaving the editor saves a pending draft first; when a draft cannot be saved, a dialog asks whether to stay or discard - drafts are never dropped silently
- External change handling: a file edited outside the app while a draft is open shows a conflict panel preserving both versions, with reload requiring explicit confirmation; a file renamed or deleted outside the app offers "Save as new note" that carries the full draft into the new file
- Read-only protection: notes over 5 MiB and files that are not valid UTF-8 open read-only with a clear banner, and the file on disk is never truncated or rewritten
- Rendered Markdown preview: Read mode and a split view (side-by-side or stacked) render notes with tables and task lists through server-side sanitization; note links navigate inside the app, external links ask for confirmation before opening, and images load only from inside the workspace
- Visual Markdown editing: compatible notes open in a rich-text editor with a formatting toolbar (bold, italic, underline, strike-through, headings, lists, task lists, links, tables, code blocks) while the file on disk stays plain Markdown; notes the visual editor cannot represent fall back to source editing with an explanation
- Copyable text: mark any span in a note so the rendered preview shows a one-click copy button next to it
- Copy actions: Copy Markdown (source), Copy Text (readable plain text with Markdown syntax removed), and Copy local path from the note actions menu, with clear success and failure feedback
- Find in note: Ctrl+F opens an in-note find bar in every mode (read, edit, source, split) with live match highlighting, current position and total count, next/previous stepping, an optional match-case toggle, and Escape to close - all without touching the file or the dashboard search
- Rename tracking: a note renamed or moved outside the app while open with no unsaved changes now follows the new name automatically - the editor and address bar update silently and no content is lost; with unsaved changes the existing conflict panel preserves the draft
- Deleted-file notice: a note deleted outside the app while open now shows the conflict panel immediately (with "Save as new note" recovery) instead of silently keeping stale content until the next save
- Settings: theme (system/light/dark), editor font size, line height, and editor width apply instantly and persist across restarts; the settings dialog opens at /settings from the gear button, Ctrl+, or the command palette, shows the active workspace path, and identifies any invalid value without losing your other changes
- Dashboard preferences persist: list/card view and sort direction now survive a restart
- Resizable panes: drag the dividers to resize the folder and note-list panes (or focus a divider and use arrow keys; Home/End snap to the limits), collapse either pane to a slim rail and restore it at its prior width - all remembered across restarts
- Safer archiving: archiving a note you are editing now saves the pending draft first; if the draft cannot be saved, the archive stops with a clear error instead of losing the last edits

### Fixed

- Markdown syntax coloring in the source editor: headings and their # marks now show in the amber accent, inline code and links get their own colors in both themes - previously everything rendered in the plain text color
- Notes are no longer rewritten on disk without an edit: opening a note in the visual editor or applying settings while one was open could silently save the file (sometimes with normalized whitespace) - the editor now saves only real edits
- Opening Settings no longer disturbs the note you were editing: the note stays open behind the dialog, applying returns you to it, and the visual editor no longer falls back to "Visual editing is unavailable" until a reload

### Changed

- Light theme ships: choosing Light (or System on a light-mode OS) now applies the warm-paper palette instantly - every color pair contrast-verified for readability; Wide editor width now gives the editor and preview more room instead of matching Medium
