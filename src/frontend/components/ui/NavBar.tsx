import type { ReactNode } from "react";
import { NoteFileIcon } from "../icons";

/*
 * <NavBar> per Design_System.md 9.1: banner landmark, app titlebar chrome.
 * Height = layout-titlebar 42px (4.1); surface-titlebar background.
 */
interface NavBarProps {
  windowTitle: string;
  actions?: ReactNode;
}

export function NavBar({ windowTitle, actions }: NavBarProps) {
  return (
    <header className="flex h-10.5 select-none items-center gap-3 border-b border-border-subtle bg-surface-titlebar pr-2.5 pl-3.5 [grid-area:titlebar]">
      <div
        aria-hidden="true"
        className="grid h-5.5 w-5.5 place-items-center rounded-control border border-border-strong text-accent"
      >
        <NoteFileIcon size={14} />
      </div>
      <span className="text-ui font-heading text-text-primary">Local Notes</span>
      <span aria-hidden="true" className="h-4 w-px bg-border-subtle" />
      <span className="min-w-0 truncate text-sm text-text-muted">{windowTitle}</span>
      <div className="ml-auto flex items-center gap-1">{actions}</div>
    </header>
  );
}
