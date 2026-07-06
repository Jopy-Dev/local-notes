import { CheckCircleIcon, WarningIcon } from "../icons";
import { Button } from "./Button";
import type { IndexState } from "../../../shared/schemas/search.js";

/*
 * <SearchRecoveryPanel> per Design_System.md 9.2 (SCREEN-007, WF-011):
 * degraded -> rebuilding -> ready/failed with editing-available copy and a
 * live-region progress announcement. Rebuild disabled while running.
 */
interface SearchRecoveryPanelProps {
  state: IndexState;
  rebuildRequested: boolean;
  onRebuild: () => void;
  onBack: () => void;
}

const COPY: Record<string, { title: string; body: string }> = {
  degraded: {
    title: "Search index is degraded",
    body: "Ranked search is unavailable. Your notes are safe and editing stays available. Rebuilding scans the workspace and recreates the index from your files.",
  },
  building: {
    title: "Rebuilding search index",
    body: "Scanning notes and recreating the index. You can keep editing - this never blocks note workflows.",
  },
  ready: {
    title: "Search index is ready",
    body: "Ranked search is available again. Head back to the dashboard to search your notes.",
  },
  unavailable: {
    title: "Search index is not available yet",
    body: "The index has not been built for this session. Rebuild it now or restart Local-Notes.",
  },
};

export function SearchRecoveryPanel({ state, rebuildRequested, onRebuild, onBack }: SearchRecoveryPanelProps) {
  const rebuilding = state === "building" || rebuildRequested;
  const copy = rebuilding ? COPY.building! : (COPY[state] ?? COPY.degraded!);
  const tone = state === "ready" ? "text-success" : "text-warning";

  return (
    <section
      aria-label="Search recovery"
      className="w-full max-w-md rounded-panel border border-border-subtle bg-surface-panel p-4.5"
    >
      <div className="flex items-center gap-2">
        <span className={`shrink-0 ${tone}`}>
          {state === "ready" ? <CheckCircleIcon size={17} /> : <WarningIcon size={17} />}
        </span>
        <h1 className="text-title font-heading text-text-primary">{copy.title}</h1>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-text-secondary">{copy.body}</p>
      <p role="status" className="mt-2 text-xs text-text-muted">
        {rebuilding ? "Rebuild in progress..." : `Index state: ${state}`}
      </p>
      <div className="mt-4 flex items-center gap-2">
        {state !== "ready" ? (
          <Button variant="primary" size="sm" onClick={onRebuild} disabled={rebuilding}>
            {rebuilding ? "Rebuilding..." : "Rebuild search index"}
          </Button>
        ) : null}
        <Button size="sm" onClick={onBack}>
          Back to dashboard
        </Button>
      </div>
    </section>
  );
}
