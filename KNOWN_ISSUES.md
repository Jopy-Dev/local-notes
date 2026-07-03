# Known Issues

Deliberately deferred items + suppression records. Entries pair with `.slop.toml` waivers per `arch/security.md` 9.7.2. Stack Health Ledger lands at Step 15 closeout.

## Suppressions

| ID | Path | Rule | Rationale | Revisit |
|---|---|---|---|---|
| `icons-registry-2026-07-03` | `src/frontend/components/icons.tsx` | `hotspots` | Icon registry: one-time bulk growth adding project-owned SVG set (Design_System.md 8 bans icon packages); low churn expected onward | 2026-08-15 or when file exceeds 300 LOC (split per icon-group) |

Resolved: `api-suite-growth-2026-07-03` - `tests/api/app.spec.ts` split into `boundary.spec.ts` + `system-routes.spec.ts` (Wave 2, 2026-07-03); waiver removed.
