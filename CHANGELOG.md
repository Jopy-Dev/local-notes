# Changelog

All notable changes to this project will be documented in this file. Format follows Keep a Changelog; versions follow Semantic Versioning. First release after the initial npm publish will be `1.0.0`.

## [Unreleased]

### Added

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
