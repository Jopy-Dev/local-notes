# Known Issues

Deliberately deferred items + suppression records. Entries pair with `.slop.toml` waivers per `arch/security.md` 9.7.2. Stack Health Ledger lands at Step 15 closeout.

## Suppressions

| ID | Path | Rule | Rationale | Revisit |
|---|---|---|---|---|
| `icons-registry-2026-07-03` | `src/frontend/components/icons.tsx` | `hotspots` | Icon registry: one-time bulk growth adding project-owned SVG set (Design_System.md 8 bans icon packages); low churn expected onward | 2026-08-15 or when file exceeds 300 LOC (split per icon-group) |
| `use-shell-state-2026-07-03` | `src/frontend/pages/useShellState.ts` | `hotspots` | Rolling-window recompute re-flags the repo's top scorer after each fix; file was split twice in Wave 2 (useDashboardData + useEditorMockState, CCX now 13) and untouched by Wave 3 commits | 2026-07-31 (Wave 2 churn rolls out of the 14-day window) or next edit to the file |
| `cli-composition-root-2026-07-03` | `src/cli/index.ts` | `hotspots` | Composition root: accrues one wiring line per Step 14 wave by design; CCX 12 is healthy and real logic lives in extracted modules (discovery, launch, exit-codes) | 2026-08-15 or if CCX exceeds 20 (then split bootstrap phases) |
| `app-composition-root-2026-07-03` | `src/backend/app.ts` | `hotspots` | Composition root: accrues one route registration per Step 14 wave by design; CCX 12 is healthy and behavior lives in routes/security/error modules | 2026-08-15 or if CCX exceeds 20 (then split registration groups) |

Resolved: `api-suite-growth-2026-07-03` - `tests/api/app.spec.ts` split into `boundary.spec.ts` + `system-routes.spec.ts` (Wave 2, 2026-07-03); waiver removed.
Resolved: `launch-page-2026-07-03` - LaunchPage no longer in the hotspot rolling window after the Wave 2 frontend pass; kept as dev/pre-bootstrap fallback per locked decision (empty workspace shows the dashboard EmptyState instead of a LaunchPage rework); waiver removed (2026-07-03).
