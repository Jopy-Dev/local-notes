import type { ReactNode } from "react";

/*
 * <AppShell> per Design_System.md 9.2: three-pane grid (layout tokens 4.1),
 * focus layout hides titlebar/folders/notes and keeps editor + status
 * (layout-focus). Compact column widths 190/280 at desktop-min (4.3).
 */
interface AppShellProps {
  layout: "standard" | "focus";
  titlebar: ReactNode;
  folders: ReactNode;
  notes: ReactNode;
  editor: ReactNode;
  status: ReactNode;
}

export function AppShell({ layout, titlebar, folders, notes, editor, status }: AppShellProps) {
  const focus = layout === "focus";

  return (
    <div
      className={
        focus
          ? "grid h-dvh w-full grid-rows-[minmax(0,1fr)_24px] bg-surface-root [grid-template-areas:'editor'_'status']"
          : "grid h-dvh w-full grid-cols-[190px_280px_minmax(0,1fr)] grid-rows-[42px_minmax(0,1fr)_24px] bg-surface-root [grid-template-areas:'titlebar_titlebar_titlebar'_'folders_notes_editor'_'status_status_status'] desktop:grid-cols-[220px_320px_minmax(0,1fr)]"
      }
    >
      {focus ? null : titlebar}
      {focus ? null : (
        <div className="min-h-0 min-w-0 overflow-hidden [grid-area:folders]">{folders}</div>
      )}
      {focus ? null : (
        <div className="min-h-0 min-w-0 overflow-hidden [grid-area:notes]">{notes}</div>
      )}
      <div className="min-h-0 min-w-0 overflow-hidden [grid-area:editor]">{editor}</div>
      {status}
    </div>
  );
}
