# ADR-004: Deferred Visual QA Evidence for Late Design-System Primitives

Date: 2026-07-03
Status: Accepted

## Context

`arch/design.md` requires visual proof (screenshots) for documented primitives before lock. `Design_System.md` v1.2→v1.3 added `<PaneDivider>`, `<FindInNoteBar>`, and the `<copy>` `<IconButton>` affordance (REQ-034/035/036) as documentation-only entries; the original Step 9 review also flagged never-prototyped states (card view, move panel, archive collision, search recovery, skeleton/loading, read-only/oversized). User approved shipping the v1.3 lock without live screenshot evidence for these (2026-07-03).

## Decision

Accept documentation-only status for the listed primitives at design lock. Capture live screenshot evidence when each primitive's owning screen is built at Step 14, using chrome-devtools-mcp against the real React implementation instead of retrofitting HTML prototypes.

## Alternatives Rejected

- **Extend HTML prototypes first.** Double work: prototype markup is throwaway once typed React primitives exist; the Step 11 port already proved prototype→React parity holds.
- **Block v1.3 lock until evidence exists.** Would have stalled REQ-034/035/036 spec approval on artwork for components whose behavior contracts were already fully specified in tables.

## Trade-offs

Risk: a documented primitive proves visually wrong when first built, forcing a Design_System version bump mid-Step-14. Contained by the Primitive Extension Protocol (`Design_System.md` §12) which already handles versioned extension.

## Consequences

Step 11 app-shell port cleared part of the backlog with live evidence (`.qa/parity-audit/wave-01/`): ConflictPanel banner, search no-results state, CommandPalette, Settings + Create-note dialogs. Still owed at Step 14: PaneDivider, FindInNoteBar, copy-affordance IconButton usage, card view, move panel drawer, archive collision dialog, search recovery screen, skeleton/loading, read-only/oversized banners. Tracked in `Implementation_Plan.md` wave exit criteria.
