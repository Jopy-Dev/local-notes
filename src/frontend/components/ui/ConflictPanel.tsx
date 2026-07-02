import { WarningIcon } from "../icons";
import { Button } from "./Button";

/*
 * <ConflictPanel> (banner form) per Design_System.md 9.2 / SCREEN-006:
 * role=alert region, explicit actions, draft preserved copy (WF-007).
 */
interface ConflictPanelProps {
  visible: boolean;
  onReload: () => void;
  onKeepDraft: () => void;
}

export function ConflictPanel({ visible, onReload, onKeepDraft }: ConflictPanelProps) {
  if (!visible) return null;

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
          This file changed outside Local Notes
        </strong>
        <span className="mt-0.5 block text-2xs text-text-secondary">
          Your draft is preserved. Choose which version should continue.
        </span>
      </div>
      <div className="flex gap-1">
        <Button size="sm" onClick={onReload}>
          Reload disk version
        </Button>
        <Button size="sm" variant="primary" onClick={onKeepDraft}>
          Keep my draft
        </Button>
      </div>
    </section>
  );
}
