import type { ReactNode } from "react";

/*
 * <AppShell> per Design_System.md 9.2: three-pane grid (layout tokens 4.1),
 * focus layout hides titlebar/folders/notes and keeps editor + status
 * (layout-focus). With `panes` set (REQ-034), pane widths come from workspace
 * UI state and dividers render between columns; without it, the static
 * compact/desktop columns apply (190/280 at desktop-min, 220/320 at desktop).
 */
export interface AppShellPanes {
  /* Resolved pixel widths - collapsed panes already mapped to the rail width. */
  folderWidth: number;
  notesWidth: number;
  /* True at the desktop breakpoint (>=1280px) where resize is allowed. */
  resizable: boolean;
  folderDivider: ReactNode;
  notesDivider: ReactNode;
}

interface AppShellProps {
  layout: "standard" | "focus";
  titlebar: ReactNode;
  folders: ReactNode;
  notes: ReactNode;
  editor: ReactNode;
  status: ReactNode;
  panes?: AppShellPanes;
}

const COMPACT_COLUMNS = "190px 6px 280px 6px minmax(0,1fr)";

export function AppShell({ layout, titlebar, folders, notes, editor, status, panes }: AppShellProps) {
  const focus = layout === "focus";

  if (focus) {
    return (
      <div className="grid h-dvh w-full grid-rows-[minmax(0,1fr)_24px] bg-surface-root [grid-template-areas:'editor'_'status']">
        <div className="min-h-0 min-w-0 overflow-hidden [grid-area:editor]">{editor}</div>
        {status}
      </div>
    );
  }

  if (!panes) {
    return (
      <div className="grid h-dvh w-full grid-cols-[190px_280px_minmax(0,1fr)] grid-rows-[42px_minmax(0,1fr)_24px] bg-surface-root [grid-template-areas:'titlebar_titlebar_titlebar'_'folders_notes_editor'_'status_status_status'] desktop:grid-cols-[220px_320px_minmax(0,1fr)]">
        {titlebar}
        <div className="min-h-0 min-w-0 overflow-hidden [grid-area:folders]">{folders}</div>
        <div className="min-h-0 min-w-0 overflow-hidden [grid-area:notes]">{notes}</div>
        <div className="min-h-0 min-w-0 overflow-hidden [grid-area:editor]">{editor}</div>
        {status}
      </div>
    );
  }

  const columns = panes.resizable
    ? `${panes.folderWidth}px 6px ${panes.notesWidth}px 6px minmax(0,1fr)`
    : COMPACT_COLUMNS;

  return (
    <div
      style={{ gridTemplateColumns: columns }}
      className="grid h-dvh w-full grid-rows-[42px_minmax(0,1fr)_24px] bg-surface-root [grid-template-areas:'titlebar_titlebar_titlebar_titlebar_titlebar'_'folders_divf_notes_divn_editor'_'status_status_status_status_status']"
    >
      {titlebar}
      <div className="min-h-0 min-w-0 overflow-hidden [grid-area:folders]">{folders}</div>
      <div className="min-h-0 [grid-area:divf]">{panes.folderDivider}</div>
      <div className="min-h-0 min-w-0 overflow-hidden [grid-area:notes]">{notes}</div>
      <div className="min-h-0 [grid-area:divn]">{panes.notesDivider}</div>
      <div className="min-h-0 min-w-0 overflow-hidden [grid-area:editor]">{editor}</div>
      {status}
    </div>
  );
}
