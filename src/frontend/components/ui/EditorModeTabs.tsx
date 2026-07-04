/*
 * <EditorModeTabs> per Design_System.md 9.2: segmented mode control with
 * pressed semantics; shortcut documented in command palette (Ctrl+\ split).
 */
type EditorMode = "read" | "edit" | "source" | "split";

interface EditorModeTabsProps {
  mode: EditorMode;
  onChange: (mode: EditorMode) => void;
  modes?: readonly EditorMode[];
}

const modeLabel: Record<EditorMode, string> = {
  read: "Read",
  edit: "Edit",
  source: "Source",
  split: "Split",
};

export function EditorModeTabs({
  mode,
  onChange,
  modes = ["read", "edit", "source", "split"],
}: EditorModeTabsProps) {
  return (
    <div
      aria-label="Editor mode"
      className="inline-flex rounded-control border border-border-subtle bg-surface-input p-0.5"
    >
      {modes.map((candidate) => (
        <button
          key={candidate}
          type="button"
          aria-pressed={candidate === mode}
          onClick={() => onChange(candidate)}
          className={[
            "h-6 min-w-11.5 cursor-pointer rounded-sm border-0 px-2 text-xs",
            candidate === mode
              ? "bg-surface-raised text-text-primary shadow-control-active"
              : "bg-transparent text-text-muted hover:text-text-secondary",
          ].join(" ")}
        >
          {modeLabel[candidate]}
        </button>
      ))}
    </div>
  );
}

export type { EditorMode };
