# Known Issues

Deliberately deferred items + suppression records. Entries pair with `.slop.toml` waivers per `arch/security.md` 9.7.2. Stack Health Ledger lands at Step 15 closeout.

## Suppressions

| ID | Path | Rule | Rationale | Revisit |
|---|---|---|---|---|
| `icons-registry-2026-07-03` | `src/frontend/components/icons.tsx` | `hotspots` | Icon registry: one-time bulk growth adding project-owned SVG set (Design_System.md 8 bans icon packages); low churn expected onward | 2026-08-15 or when file exceeds 300 LOC (split per icon-group) |
| `use-shell-state-2026-07-03` | `src/frontend/pages/useShellState.ts` | `hotspots` | Rolling-window recompute re-flags the repo's top scorer after each fix; file was split twice in Wave 2 (useDashboardData + useEditorMockState, CCX now 13) and untouched by Wave 3 commits | 2026-07-31 (Wave 2 churn rolls out of the 14-day window) or next edit to the file |
| `cli-composition-root-2026-07-03` | `src/cli/index.ts` | `hotspots` | Composition root: accrues one wiring line per Step 14 wave by design; CCX 12 is healthy and real logic lives in extracted modules (discovery, launch, exit-codes) | 2026-08-15 or if CCX exceeds 20 (then split bootstrap phases) |
| `app-composition-root-2026-07-03` | `src/backend/app.ts` | `hotspots` | Composition root: accrues one route registration per Step 14 wave by design; CCX 12 is healthy and behavior lives in routes/security/error modules | 2026-08-15 or if CCX exceeds 20 (then split registration groups) |
| `shell-dialogs-hotspot-2026-07-04` | `src/frontend/components/shell/ShellDialogs.tsx` | `structural.hotspots` | Dialog aggregator gains one dialog set per Step 14 wave by design (Wave 5 added save-as-new + reload/discard confirmations); 134 LOC and CCX 14 are healthy, flag is the rolling-window top-scorer recompute | 2026-08-15 or if CCX exceeds 20 (then split per-dialog files) |
| `editor-controller-wmc-2026-07-04` | `src/frontend/editor/editor-controller.ts` | `structural.class.complexity` | EditorController is one cohesive state machine (autosave scheduling, conflict transitions, REQ-017 navigation guard); WMC 57 vs 40 reflects inherent branching, behavior fully covered by `tests/unit/editor-controller.spec.ts` | 2026-08-15 or first Wave 6 edit to the file (extract AutosaveScheduler: timer + in-flight + queue) |
| `editor-data-hotspot-2026-07-04` | `src/frontend/stores/editorData.ts` | `structural.hotspots` | React adapter over EditorController; Wave 6 growth was verdict wiring, since extracted to `src/frontend/editor/visual-verdict.ts` (CCX 38->32); remainder is controller delegation + REQ-017 pendingNavigation parking, cohesive by design; flag is rolling-window top-scorer recompute | 2026-08-15 or if CCX exceeds 35 (then split pendingNavigation flow) |
| `markdown-preview-hotspot-2026-07-04` | `src/frontend/editor/MarkdownPreview.tsx` | `structural.hotspots` | Wave 6 preview surface split twice into `src/frontend/editor/preview-support.ts` (debounced render hook, guarded-asset hydration, REQ-036 copy mounts), CCX 44->17; growth stat is committed Wave 6 history inside the 14-day window and cannot shrink by further edits; flag is rolling-window top-scorer recompute | 2026-08-15 (Wave 6 churn rolls out of window) or if CCX exceeds 20 |
| `source-editor-hotspot-2026-07-04` | `src/frontend/editor/SourceEditor.tsx` | `structural.hotspots` | CodeMirror host split twice (`src/frontend/editor/cm-theme.ts` theme, `src/frontend/editor/cm-find.ts` find field + `useCmFind` sync hook), CCX 21->17; growth stat is committed Wave 5+6 history inside the 14-day window; flag is rolling-window top-scorer recompute | 2026-08-15 (wave churn rolls out of window) or if CCX exceeds 20 |

## Deferred Edge Cases

| Area | Behavior deferred | Rationale | Revisit |
|---|---|---|---|
| Archive while draft dirty (`WF-009` x `REQ-017`) | Archiving the open note discards an unsaved draft without a flush; the archive dialog is an explicit user action on the note | Archive moves the file; flushing into a path being archived races the move. Draft loss window is the 750ms debounce | Wave 7 settings/pane pass, or first user report |
| External delete while editor clean (`REQ-018` edge) | A clean open note deleted outside the app keeps showing its last content; the next save surfaces the conflict panel instead of a proactive notice | REQ-018 defines conflict handling for dirty drafts only; clean-state delete is recoverable via the conflict flow with no data at risk | Wave 6 editor pass |
| External rename while editor clean (`REQ-018` acceptance PARTIAL) | "Clean open note renamed externally follows new path automatically" is not implemented: `note.renamed` exists in the event-bus union but the watch pipeline emits only removed/added; the open editor keeps the stale key | Rename correlation (unlink+add pairing) is backend watcher work out of Wave 5 UI scope; no data loss - dirty case is fully covered by source-missing + save-as-new | Wave 6 editor pass (emit `note.renamed`, editor follows route/key) |

Resolved: `api-suite-growth-2026-07-03` - `tests/api/app.spec.ts` split into `boundary.spec.ts` + `system-routes.spec.ts` (Wave 2, 2026-07-03); waiver removed.
Resolved: `launch-page-2026-07-03` - LaunchPage no longer in the hotspot rolling window after the Wave 2 frontend pass; kept as dev/pre-bootstrap fallback per locked decision (empty workspace shows the dashboard EmptyState instead of a LaunchPage rework); waiver removed (2026-07-03).
