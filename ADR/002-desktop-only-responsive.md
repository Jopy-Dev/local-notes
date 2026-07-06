# ADR-002: Desktop/Laptop-Only Viewport Contract

Date: 2026-07-03
Status: Accepted

## Context

Baseline frontend standard mandates mobile-first with 375/768/1280 verification (`brain` §19; `arch/design.md`). Local-Notes is a dense three-pane desktop writing tool driven by a local server process on the same machine (PRD `REQ-031`).

## Decision

Support desktop/laptop browsers only. Minimum viewport `1024x640`; optimized targets `1280x720` and `1440x900`. Below minimum, render an explicit `<UnsupportedViewport>` resize-guidance surface instead of a collapsed mobile layout (PRD `REQ-031`, `Design_System.md` §4.3). Mobile phones and tablets are out of MVP scope (PRD §8).

## Alternatives Rejected

- **Responsive mobile layout.** The product cannot run on a phone anyway — the Node.js server runs on the desktop; a phone browser has no loopback server to reach. Building mobile navigation for a surface that cannot exist is pure cost.
- **Silent min-width clamp with horizontal scroll.** Violates `REQ-030`/`REQ-031` (no page-level horizontal scroll) and hides the real constraint from the user; explicit guidance with live dimensions is honest and testable.

## Trade-offs

Users with very small laptop windows must enlarge the window; acceptable for a keyboard-centric writing tool. Accessibility zoom at 200% is still honored within the supported contract (`Design_System.md` §11).

## Consequences

E2E viewport matrix: `1024x640`, `1280x720`, `1440x900` supported; `360/390/768` verify guidance rendering only (`MasterPrompt.md` §8.4). Visual QA evidence at these widths already captured (`.qa/parity-audit/wave-00/`, `wave-01/`).
