# ADR-006: Node.js Engines Range and Release Target

Date: 2026-07-03
Status: Accepted

## Context

`MasterPrompt.md` §1.5 defers the `engines.node` pick to Step 12. Verified 2026-07-03 (endoflife.date + nodejs.org): Node 24 = Active LTS (EOL 2028-04-30), Node 22 = Maintenance LTS (EOL 2027-04-30), Node 26 = Current (LTS from 2026-10-28). Development machine runs 22.22.2. All pinned toolchain engines accept 22.12+ (Vite `^20.19||>=22.12`, Vitest, Playwright).

## Decision

- `package.json` `engines.node` = `">=22.12.0"` — accepts Maintenance 22 and Active 24
- Release acceptance (`REQ-001`: "Node.js Active LTS at package release") validates on Node 24; Step 15 CI test matrix runs 22 + 24
- Local development stays on 22 until Step 15; upgrade recommendation to 24 stands for the release window
- Revisit trigger: Node 22 EOL (2027-04-30) or a dependency requiring >=24

## Alternatives Rejected

- **`>=24` strict.** Blocks the current dev machine and every Maintenance-LTS user for no runtime need — no dependency requires 24.
- **`>=20.19`.** Node 20 hits EOL 2026-04-30 (already past); advertising support for an EOL line violates `arch/core.md` §1.2.

## Trade-offs

Two-major support widens the test matrix by one CI job at Step 15. Acceptable; the alternative is excluding either the dev machine or Active-LTS users.

## Consequences

CI `node-version: 22` today (dev parity); Step 15 adds a 24 job. `engines` field already matches this ADR.
