import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { SearchIcon } from "../icons";
import { Kbd } from "./Kbd";

/*
 * <CommandPalette> per Design_System.md 9.2: modal combobox surface, Escape
 * closes (native dialog), focus returns to trigger. Width = layout-command.
 * Static command list at Step 11; filtering lands with real commands.
 */
export interface CommandEntry {
  key: string;
  label: string;
  shortcut: string;
  icon: ReactNode;
  onRun: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  groups: readonly { label: string; commands: readonly CommandEntry[] }[];
}

export function CommandPalette({ open, onClose, groups }: CommandPaletteProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      requestAnimationFrame(() => inputRef.current?.focus());
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-label="Command palette"
      onClose={onClose}
      onCancel={onClose}
      className="mx-auto mt-[12vh] w-[min(620px,calc(100vw-48px))] overflow-hidden rounded-panel border border-border-strong bg-surface-panel p-0 text-text-primary shadow-popover"
    >
      <div className="flex items-center gap-2 border-b border-border-subtle px-3 py-2.5">
        <span className="text-text-muted">
          <SearchIcon size={17} />
        </span>
        <label htmlFor="command-search" className="sr-only">
          Search commands
        </label>
        <input
          ref={inputRef}
          id="command-search"
          placeholder="Type a command or note title"
          autoComplete="off"
          className="min-w-0 flex-1 border-0 bg-transparent p-0 text-body text-text-primary placeholder:text-text-muted"
        />
        <Kbd>Esc</Kbd>
      </div>
      <div className="max-h-90 overflow-y-auto p-1.5 [scrollbar-color:var(--color-border-strong)_transparent] [scrollbar-width:thin]">
        {groups.map((group) => (
          <div key={group.label}>
            <div className="px-2 pt-2 pb-1 text-2xs font-heading tracking-eyebrow text-text-muted uppercase">
              {group.label}
            </div>
            {group.commands.map((command) => (
              <button
                key={command.key}
                type="button"
                onClick={command.onRun}
                className="grid min-h-9.5 w-full cursor-pointer grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-2 rounded-control border-0 bg-transparent px-2 text-left text-ui text-text-secondary hover:bg-surface-hover hover:text-text-primary focus-visible:bg-surface-hover [&_svg]:text-text-muted"
              >
                <span>{command.icon}</span>
                <span className="truncate">{command.label}</span>
                <Kbd>{command.shortcut}</Kbd>
              </button>
            ))}
          </div>
        ))}
      </div>
    </dialog>
  );
}
