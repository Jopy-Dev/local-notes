import { EditorPane } from "../components/shell/EditorPane";
import { FoldersPane } from "../components/shell/FoldersPane";
import { NotesPane } from "../components/shell/NotesPane";
import { ShellDialogs } from "../components/shell/ShellDialogs";
import { ShellStatusBar } from "../components/shell/ShellStatusBar";
import { ShellTitlebar } from "../components/shell/ShellTitlebar";
import { AppShell } from "../components/ui/AppShell";
import { UnsupportedViewport, useViewportSupported } from "../components/ui/UnsupportedViewport";
import { useShellState } from "./useShellState";

/*
 * Workspace shell parity screen (SCREEN-001/002 shell). Visual parity source:
 * .claude-design/project/app-shell.html. All data/actions are mock at Step 11;
 * real APIs, editors, and router land at Step 12+.
 */
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
        folders={
          <FoldersPane
            activeKey={shell.activeFolder}
            onSelect={shell.setActiveFolder}
            onCreateNote={() => shell.setDialog("new-note")}
            onRefresh={() => shell.toast.show("Workspace refreshed")}
          />
        }
        notes={
          <NotesPane
            notes={shell.filteredNotes}
            selectedKey={shell.selectedNote}
            onSelect={shell.selectNote}
            query={shell.query}
            onQueryChange={shell.setQuery}
            descending={shell.descending}
            onToggleDirection={shell.toggleDirection}
            searchRef={shell.searchRef}
          />
        }
        editor={
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
            conflictVisible={shell.conflictVisible}
            onShowConflict={() => shell.setConflictVisible(true)}
            onResolveConflict={(message) => {
              shell.setConflictVisible(false);
              shell.toast.show(message);
            }}
          />
        }
        status={<ShellStatusBar />}
      />
      <ShellDialogs shell={shell} />
    </>
  );
}
