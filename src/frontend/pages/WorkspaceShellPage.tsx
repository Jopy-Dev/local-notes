import { EditorPane } from "../components/shell/EditorPane";
import { FoldersPane } from "../components/shell/FoldersPane";
import { NotesPane } from "../components/shell/NotesPane";
import { ShellDialogs } from "../components/shell/ShellDialogs";
import { ShellStatusBar } from "../components/shell/ShellStatusBar";
import { ShellTitlebar } from "../components/shell/ShellTitlebar";
import { AppShell } from "../components/ui/AppShell";
import { UnsupportedViewport, useViewportSupported } from "../components/ui/UnsupportedViewport";
import { navigate } from "../services/navigation";
import { useShellState } from "./useShellState";
import type { ShellState } from "./useShellState";

/*
 * Workspace shell parity screen (SCREEN-001/002 shell). Visual parity source:
 * .claude-design/project/app-shell.html. Dashboard data is live (Wave 2);
 * editor content stays mock until Waves 5/6.
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
  return (
    <EditorPane
      title={shell.title}
      onTitleChange={(event) => shell.changeTitle(event.target.value)}
      saveState={shell.saveState}
      mode={shell.mode}
      onModeChange={shell.setMode}
      focusMode={shell.focusMode}
      onToggleFocusMode={shell.toggleFocusMode}
      menuOpen={shell.menuOpen}
      onToggleMenu={() => shell.setMenuOpen(!shell.menuOpen)}
      onCloseMenu={() => shell.setMenuOpen(false)}
      onMenuAction={shell.toast.show}
      noteSelected={shell.findNoteTitle(shell.selectedNote) !== undefined}
      onMoveNote={() => shell.setDialog("move-note")}
      onArchiveNote={() => shell.setDialog("archive-note")}
      conflictVisible={shell.conflictVisible}
      onShowConflict={() => shell.setConflictVisible(true)}
      onResolveConflict={(message) => {
        shell.setConflictVisible(false);
        shell.toast.show(message);
      }}
    />
  );
}

export function WorkspaceShellPage() {
  const supported = useViewportSupported();
  const shell = useShellState();

  if (!supported) {
    return <UnsupportedViewport />;
  }

  return (
    <>
      <AppShell
        layout={shell.focusMode ? "focus" : "standard"}
        titlebar={
          <ShellTitlebar
            onOpenCommand={() => shell.setDialog("command")}
            onOpenSettings={() => shell.setDialog("settings")}
          />
        }
        folders={<ShellFolders shell={shell} />}
        notes={<ShellNotes shell={shell} />}
        editor={<ShellEditor shell={shell} />}
        status={<ShellStatusBar />}
      />
      <ShellDialogs shell={shell} />
    </>
  );
}
