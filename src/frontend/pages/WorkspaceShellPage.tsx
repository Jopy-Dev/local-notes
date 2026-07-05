import { CollapsedRail } from "../components/shell/CollapsedRail";
import { EditorPane } from "../components/shell/EditorPane";
import { FoldersPane } from "../components/shell/FoldersPane";
import { NotesPane } from "../components/shell/NotesPane";
import { ShellDialogs } from "../components/shell/ShellDialogs";
import { ShellStatusBar } from "../components/shell/ShellStatusBar";
import { ShellTitlebar } from "../components/shell/ShellTitlebar";
import { AppShell } from "../components/ui/AppShell";
import { PaneDivider } from "../components/ui/PaneDivider";
import { UnsupportedViewport, useViewportSupported } from "../components/ui/UnsupportedViewport";
import { navigate } from "../services/navigation";
import { PANE_BOUNDS, useWorkspaceUi } from "../stores/workspaceUi";
import type { PaneKind } from "../stores/workspaceUi";
import { useIsDesktop } from "./useIsDesktop";
import { useRenameFollow } from "./useRenameFollow";
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
      recentNotes={shell.recentNotes}
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
      sortBy={shell.sortBy}
      onSortByChange={shell.setSortBy}
      descending={shell.descending}
      onToggleDirection={shell.toggleDirection}
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

const RAIL_WIDTH_PX = 28;

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
