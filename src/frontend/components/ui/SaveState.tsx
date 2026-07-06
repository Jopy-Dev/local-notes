/*
 * <SaveState> per Design_System.md 9.2: role=status, icon + text, never
 * color-only (WF-006). Dot color follows semantic state tokens.
 */
type SaveStateKind = "saved" | "unsaved" | "saving" | "conflict" | "error";

const stateCopy: Record<SaveStateKind, string> = {
  saved: "Saved locally",
  unsaved: "Unsaved",
  saving: "Saving...",
  conflict: "Conflict",
  error: "Save failed",
};

const dotClass: Record<SaveStateKind, string> = {
  saved: "bg-success",
  unsaved: "bg-warning",
  saving: "bg-warning",
  conflict: "bg-warning",
  error: "bg-danger",
};

export function SaveState({ state, compactHideText = false }: { state: SaveStateKind; compactHideText?: boolean }) {
  return (
    <span
      role="status"
      aria-live="polite"
      className="mr-1 inline-flex items-center gap-1.5 text-2xs whitespace-nowrap text-text-muted"
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-pill ${dotClass[state]}`} />
      <span className={compactHideText ? "max-desktop:hidden" : ""}>{stateCopy[state]}</span>
    </span>
  );
}

export type { SaveStateKind };
