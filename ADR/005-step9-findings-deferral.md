# ADR-005: Process Deviation — Step 11 Entered With Open Step 9 Findings

Date: 2026-07-03
Status: Accepted

## Context

`workflow/masterprompt.md` Step 10 binds: zero open improvement findings before Step 11. The Step 9 review (authored under the predecessor Codex session, migrated 2026-07-03) left open findings: visual-proof gaps (ADR-004), Focus Mode scoped under Markdown-only `REQ-015` though intent covers `.txt` too, unsourced Focus-Mode route-reset behavior, and stale MasterPrompt wording calling the design system advisory after lock.

## Decision

Proceed to Step 11 with the findings recorded as tracked debt instead of resolving them first. User explicitly accepted this deviation after the risk was named (2026-07-03, handoff Round 7).

## Alternatives Rejected

- **Complete Step 9/10 ceremony first.** User priority was reaching working code; the open findings are documentation-alignment items, not build blockers — none changes the Step 11 scaffold or the locked visual contract.

## Trade-offs

Risk: spec drift bites at Step 14 when Focus Mode and the missing visual states are implemented against slightly stale text. Mitigation: each finding is pinned to the wave that touches it (Focus Mode + persistence rule = editor wave; MasterPrompt stale reference = fix in the same PR that implements Focus Mode; visual proof = ADR-004 schedule).

## Consequences

Findings live in `Implementation_Plan.md` §13 (Open Decisions/Blockers) with owning waves. This ADR records the rule deviation itself per `brain` §9; the zero-open-findings rule stands for future projects.
