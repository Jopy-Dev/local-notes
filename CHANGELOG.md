# Changelog

All notable changes to this project will be documented in this file. Format follows Keep a Changelog; versions follow Semantic Versioning. First release after the initial npm publish will be `1.0.0`.

## [Unreleased]

### Added

- Crash-safe file handling foundations: atomic note/config writes, workspace boundary protection, single-instance lock, first-run workspace creation, settings persistence with safe defaults, bounded local diagnostics
- Project scaffold: Vite/React/Tailwind frontend toolchain, CI, repo hygiene configs
- Quiet Workbench design system tokens ported to Tailwind theme
- Launch (first-run) screen with workspace chooser dialog and resize guidance
- Workspace shell screen: folder navigation, note list with search filter, split source/preview editor layout, focus mode, command palette, settings and create-note dialogs (mock data; real filesystem wiring pending)
