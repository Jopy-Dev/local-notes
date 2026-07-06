# ADR-008: Remove Visual Editor; Source Mode with Markdown Toolbar

- Status: Accepted
- Date: 2026-07-05
- Deciders: User (product owner), Claude (engineering)

## Context

Through Wave 6 and user-feedback round 1, `.md` notes offered four modes: Read, Edit (TipTap
rich-text), Source (CodeMirror), and Split. The Edit mode required a Markdown compatibility
service to guarantee lossless round-trips (PRD REQ-015), which produced a long tail of defects:
notes the visual editor itself wrote were later rejected by its own compatibility check
(the `&nbsp;` blank-paragraph self-lockout fixed in round 1), silent whitespace rewrites,
and a structural fixed-point comparison (round 1, Option A) to paper over representation
differences. TipTap's Markdown package is beta, and the compatibility machinery spanned
shared schema, backend scan, frontend service, and editor bindings.

In user-feedback round 2 the user chose to remove the Edit panel entirely and asked for the
formatting toolbar to operate in the Source panel. Presented options: (a) visual editor
becomes the Source tab surface, (b) raw text plus a toolbar that rewrites Markdown syntax,
(c) a toggle hosting both. The user chose (b).

## Decision

Remove the TipTap visual editor and every compatibility artifact. Modes are Read / Source /
Split. Source mode is the single editing surface for `.md` and `.txt`: CodeMirror plus a
formatting toolbar whose controls are pure text transforms (`markdown-commands.ts`) producing
ordinary undoable edits - bold/italic/underline/strike/copy-mark wraps, heading level toggles,
list prefix toggles, link/table/code-block inserts, undo/redo.

Removed: `@tiptap/*` dependencies (10 packages), `VisualMarkdownEditor`, `VisualEditorToolbar`,
`visual-editor-binding`, `markdown-compat`, `visual-verdict`, `markdown-extensions`,
`copy-affordance-decorations`, `find-decorations`, the shared `compatibility-scan`, the
`markdownCompatibility`/`compatibilityReason` fields on `NoteDocument`, and the compatibility
verdict on the render response.

## Consequences

- Every Markdown construct is now editable - no source-only fallback, no round-trip gate,
  no note can be locked out of editing.
- The file on disk is only ever what the user typed; the editor cannot normalize or rewrite
  content on open or on save.
- WYSIWYG editing is gone; users format through syntax the toolbar writes for them.
- The round-1 structural-compatibility work and visual-mode copy affordance became dead code
  and were removed with this change (user informed before round 1 merged).
- Bundle drops 70 packages; the CSP nonce path now serves CodeMirror only.

## Rejected Alternatives

- Visual editor inside the Source tab: keeps the compatibility machinery and its defect
  class; contradicts the user's explicit choice of raw text.
- Toggle hosting both surfaces: retains all TipTap maintenance cost for a secondary surface,
  plus mode-within-mode UI complexity.
- Keeping Edit as-is: rejected by the user in round 2 feedback.
