import { useEffect, useRef, useSyncExternalStore } from "react";
import { ChevronRightIcon } from "../components/icons";
import { EditorPane } from "../components/shell/EditorPane";
import { FoldersPane } from "../components/shell/FoldersPane";
import { NotesPane } from "../components/shell/NotesPane";
import { ShellDialogs } from "../components/shell/ShellDialogs";
import { ShellStatusBar } from "../components/shell/ShellStatusBar";
import { ShellTitlebar } from "../components/shell/ShellTitlebar";
import { AppShell } from "../components/ui/AppShell";
import { IconButton } from "../components/ui/IconButton";
import { PaneDivider } from "../components/ui/PaneDivider";
import { UnsupportedViewport, useViewportSupported } from "../components/ui/UnsupportedViewport";
import { navigate } from "../services/navigation";
import { useEditorData } from "../stores/editorData";
import { PANE_BOUNDS, useWorkspaceUi } from "../stores/workspaceUi";
import type { PaneKind } from "../stores/workspaceUi";
import { useShellState } from "./useShellState";
import type { ShellState } from "./useShellState";

/*
 * Workspace shell (SCREEN-001/002): live dashboard + live editor (Wave 5).
 * Visual parity source: .claude-design/project/app-shell.html.
 */
function ShellFolders({ shell }: { shell: ShellState }) {
  return (
    <FoldersPane
      activeKey={shell.activeFolder}
      onSelect={shell.setActiveFolder}
      onCreateNote={() => shell.setDialog("new-note")}
      onRefresh={() => shell.toast.show("Workspace refreshed")}
      totalNotes={shell.totalNotes}
      folders={shell.folders}
      folderCounts={shell.folderCountMap}
    />
  );
}

function ShellNotes({ shell }: { shell: ShellState }) {
  return (
    <NotesPane
      notes={shell.filteredNotes}
      selectedKey={shell.selectedNote}
      onSelect={shell.selectNote}
      query={shell.query}
      onQueryChange={shell.setQuery}
      descending={shell.descending}
      onToggleDirection={shell.toggleDirection}
      view={shell.view}
      onViewChange={shell.setView}
      loading={shell.dataLoading}
      totalLabel={shell.totalLabel}
      hasMore={shell.hasMore}
      onLoadMore={shell.loadMore}
      onCreateNote={() => shell.setDialog("new-note")}
      searchStatus={shell.searchStatus}
      searchResults={shell.searchResults}
      searchHasMore={shell.searchHasMore}
      onLoadMoreResults={shell.loadMoreResults}
      indexState={shell.indexState}
      onOpenRecovery={() => navigate("/recovery/search")}
      searchRef={shell.searchRef}
    />
  );
}

function ShellEditor({ shell }: { shell: ShellState }) {
  const { editor } = shell;
  return (
    <EditorPane
      document={editor.document}
      draft={editor.draft}
      saveState={editor.saveState}
      conflict={editor.conflict}
      readOnlyReason={editor.readOnlyReason}
      loadError={editor.loadError}
      onChangeDraft={editor.changeDraft}
      onRetrySave={editor.retry}
      onResolveReload={() => shell.setDialog("confirm-reload")}
      onResolveOverwrite={() => void editor.resolveOverwrite()}
      onSaveAsNew={() => shell.setDialog("new-note")}
      onCloseWithoutSaving={() => {
        editor.discardAndClose();
        navigate("/");
      }}
      mode={shell.mode}
      onModeChange={shell.setMode}
      visualCompatibility={editor.visualCompatibility}
      visualCompatibilityReason={editor.visualCompatibilityReason}
      splitLayout={shell.splitLayout}
      onCycleSplitLayout={shell.cycleSplitLayout}
      focusMode={shell.focusMode}
      onToggleFocusMode={shell.toggleFocusMode}
      menuOpen={shell.menuOpen}
      onToggleMenu={() => shell.setMenuOpen(!shell.menuOpen)}
      onCloseMenu={() => shell.setMenuOpen(false)}
      onToast={shell.toast.show}
      find={shell.find}
      onOpenFind={shell.openFind}
      onCopyMarkdown={shell.copyMarkdown}
      onCopyText={shell.copyText}
      onCopyLocalPath={shell.copyLocalPath}
      onMoveNote={() => shell.setDialog("move-note")}
      onArchiveNote={() => shell.setDialog("archive-note")}
    />
  );
}

/*
 * REQ-018: a clean open note renamed outside the app swaps the editor key;
 * the route follows silently. The editor key moving away from the routed key
 * can only be a rename follow - every other transition starts from a route
 * change, so the route is already ahead of the editor in those cases.
 */
function useRenameFollow(routeNoteKey: string | null) {
  const editorNoteKey = useEditorData((state) => state.noteKey);
  const previous = useRef(editorNoteKey);
  useEffect(() => {
    const before = previous.current;
    previous.current = editorNoteKey;
    if (!before || !editorNoteKey || before === editorNoteKey) return;
    if (routeNoteKey === before) {
      window.history.replaceState(null, "", `/notes/${editorNoteKey}`);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  }, [editorNoteKey, routeNoteKey]);
}

/* Resize/collapse active only at the desktop breakpoint (REQ-034; DS 4.3). */
const DESKTOP_QUERY = "(min-width: 1280px)";
const RAIL_WIDTH_PX = 28;

function useIsDesktop(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(DESKTOP_QUERY);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => true,
  );
}

function CollapsedRail({ pane, onExpand }: { pane: PaneKind; onExpand: () => void }) {
  return (
    <div className="flex h-full w-full flex-col items-center border-r border-border-subtle bg-surface-sidebar pt-1.5">
      <IconButton
        label={pane === "folder" ? "Expand folder pane" : "Expand note list pane"}
        onClick={onExpand}
      >
        <ChevronRightIcon size={14} />
      </IconButton>
    </div>
  );
}

export function WorkspaceShellPage({
  noteKey = null,
  settingsOpen = false,
}: {
  noteKey?: string | null;
  settingsOpen?: boolean;
}) {
  const supported = useViewportSupported();
  const shell = useShellState(noteKey, settingsOpen);
  const isDesktop = useIsDesktop();
  const panesUi = useWorkspaceUi();
  useRenameFollow(noteKey);

  if (!supported) {
    return <UnsupportedViewport />;
  }

  const divider = (pane: PaneKind) => (
    <PaneDivider
      pane={pane}
      width={panesUi.widths[pane]}
      min={PANE_BOUNDS[pane].min}
      max={PANE_BOUNDS[pane].max}
      disabled={!isDesktop || panesUi.collapsed[pane]}
      onResize={(width) => panesUi.resizePane(pane, width)}
      onCommit={(width) => panesUi.commitPane(pane, width)}
      onToggleCollapse={() => panesUi.toggleCollapsed(pane)}
    />
  );
  const paneWidth = (pane: PaneKind) =>
    panesUi.collapsed[pane] ? RAIL_WIDTH_PX : panesUi.widths[pane];

  return (
    <>
      <AppShell
        layout={shell.focusMode ? "focus" : "standard"}
        titlebar={
          <ShellTitlebar
            onOpenCommand={() => shell.setDialog("command")}
            onOpenSettings={shell.openSettings}
          />
        }
        folders={
          panesUi.collapsed.folder && isDesktop ? (
            <CollapsedRail pane="folder" onExpand={() => panesUi.toggleCollapsed("folder")} />
          ) : (
            <ShellFolders shell={shell} />
          )
        }
        notes={
          panesUi.collapsed.notes && isDesktop ? (
            <CollapsedRail pane="notes" onExpand={() => panesUi.toggleCollapsed("notes")} />
          ) : (
            <ShellNotes shell={shell} />
          )
        }
        editor={<ShellEditor shell={shell} />}
        status={<ShellStatusBar document={shell.editor.document} saveState={shell.editor.saveState} />}
        panes={{
          folderWidth: paneWidth("folder"),
          notesWidth: paneWidth("notes"),
          resizable: isDesktop,
          folderDivider: divider("folder"),
          notesDivider: divider("notes"),
        }}
      />
      <ShellDialogs shell={shell} />
    </>
  );
}
