import { NoteFileIcon, SearchIcon, SettingsIcon } from "../icons";
import { IconButton } from "../ui/IconButton";
import { Kbd } from "../ui/Kbd";
import { getWorkspaceDisplayPath } from "../../services/workspace";

/*
 * Workspace titlebar: brand, workspace path, command trigger, settings.
 * Parity source: app-shell.html titlebar.
 */
interface ShellTitlebarProps {
  onOpenCommand: () => void;
  onOpenSettings: () => void;
}

export function ShellTitlebar({ onOpenCommand, onOpenSettings }: ShellTitlebarProps) {
  return (
    <header className="flex h-10.5 min-w-0 select-none items-center gap-3 border-b border-border-subtle bg-surface-titlebar pr-2.5 pl-3 [grid-area:titlebar]">
      <div
        aria-hidden="true"
        className="grid h-5.5 w-5.5 shrink-0 place-items-center rounded-control border border-border-strong text-accent"
      >
        <NoteFileIcon size={14} />
      </div>
      <span className="text-ui font-heading text-text-primary">Local Notes</span>
      <span aria-hidden="true" className="h-4 w-px bg-border-subtle" />
      <span className="min-w-0 truncate font-mono text-xs text-text-muted">
        {getWorkspaceDisplayPath() ?? ""}
      </span>
      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={onOpenCommand}
          className="inline-flex h-7 min-w-36 cursor-pointer items-center gap-2 rounded-control border border-border-subtle bg-surface-input px-2 text-left text-ui text-text-muted hover:border-border-strong hover:text-text-secondary desktop:min-w-47"
        >
          <SearchIcon size={14} />
          Search or run command
          <span className="ml-auto">
            <Kbd>Ctrl K</Kbd>
          </span>
        </button>
        <IconButton label="Open settings" title="Settings (Ctrl+,)" onClick={onOpenSettings}>
          <SettingsIcon size={16} />
        </IconButton>
      </div>
    </header>
  );
}
