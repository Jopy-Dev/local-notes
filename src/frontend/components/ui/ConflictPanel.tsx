import { WarningIcon } from "../icons";
import { Button } from "./Button";

/*
 * <ConflictPanel> per Design_System.md 9.2 / SCREEN-006 (WF-007, REQ-018):
 * role=alert, explicit actions, both versions preserved until a choice
 * succeeds. "changed" offers reload/overwrite; "source-missing" offers
 * save-as-new-note or close without saving.
 */
interface ConflictPanelProps {
  kind: "changed" | "source-missing" | null;
  onReload: () => void;
  onKeepDraft: () => void;
  onSaveAsNew: () => void;
  onCloseWithoutSaving: () => void;
}

export function ConflictPanel({ kind, onReload, onKeepDraft, onSaveAsNew, onCloseWithoutSaving }: ConflictPanelProps) {
  if (kind === null) return null;

  const missing = kind === "source-missing";
  return (
    <section
      role="alert"
      className="grid grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-2.5 border-b border-border-active bg-warning-bg py-2 pr-3 pl-4.5"
    >
      <span className="text-warning">
        <WarningIcon size={18} />
      </span>
      <div>
        <strong className="block text-xs font-heading text-text-primary">
          {missing
            ? "This file was renamed or deleted outside Local Notes"
            : "This file changed outside Local Notes"}
        </strong>
        <span className="mt-0.5 block text-2xs text-text-secondary">
          {missing
            ? "Your draft is preserved in memory. Save it as a new note or close without saving."
            : "Your draft is preserved. Choose which version should continue."}
        </span>
      </div>
      <div className="flex gap-1">
        {missing ? (
          <>
            <Button size="sm" onClick={onCloseWithoutSaving}>
              Close without saving
            </Button>
            <Button size="sm" variant="primary" onClick={onSaveAsNew}>
              Save as new note
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" onClick={onReload}>
              Reload disk version
            </Button>
            <Button size="sm" variant="primary" onClick={onKeepDraft}>
              Overwrite with draft
            </Button>
          </>
        )}
      </div>
    </section>
  );
}
