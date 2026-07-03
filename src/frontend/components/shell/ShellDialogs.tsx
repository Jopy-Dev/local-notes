import type { ShellState } from "../../pages/useShellState";
import { useWorkspaceData } from "../../stores/workspaceData";
import { CommandPalette } from "../ui/CommandPalette";
import { Toast } from "../ui/Toast";
import { ArchiveDialog } from "./ArchiveDialog";
import { MoveNotePanel } from "./MoveNotePanel";
import { NewNoteDialog } from "./NewNoteDialog";
import { SettingsDialog } from "./SettingsDialog";
import { buildShellCommands } from "./shellCommands";

// Transient layers for the workspace shell: palette, dialogs, toast.
export function ShellDialogs({ shell }: { shell: ShellState }) {
  const commands = buildShellCommands({
    createNote: () => shell.setDialog("new-note"),
    focusSearch: shell.focusSearch,
    toggleSplit: () => {
      shell.setDialog(null);
      shell.toggleSplit();
    },
    toggleFocusMode: shell.toggleFocusMode,
    openSettings: () => shell.setDialog("settings"),
  });

  const selectedTitle = shell.findNoteTitle(shell.selectedNote);
  const refresh = () => void useWorkspaceData.getState().loadInitial();

  return (
    <>
      <CommandPalette
        open={shell.dialog === "command"}
        onClose={() => shell.setDialog(null)}
        groups={commands}
      />
      <NewNoteDialog
        open={shell.dialog === "new-note"}
        folders={shell.folders}
        onClose={() => shell.setDialog(null)}
        onCreated={(note) => {
          shell.setDialog(null);
          refresh();
          shell.selectNote(note.noteKey);
          shell.toast.show(`${note.filename} created`);
        }}
      />
      {selectedTitle !== undefined ? (
        <MoveNotePanel
          open={shell.dialog === "move-note"}
          noteKey={shell.selectedNote}
          noteTitle={selectedTitle}
          folders={shell.folders}
          onClose={() => shell.setDialog(null)}
          onMoved={(note) => {
            shell.setDialog(null);
            refresh();
            shell.selectNote(note.noteKey);
            shell.toast.show(`Moved to ${note.folder || "workspace root"}`);
          }}
        />
      ) : null}
      {selectedTitle !== undefined ? (
        <ArchiveDialog
          open={shell.dialog === "archive-note"}
          noteKey={shell.selectedNote}
          noteTitle={selectedTitle}
          onClose={() => shell.setDialog(null)}
          onArchived={(archivedRelativePath) => {
            shell.setDialog(null);
            refresh();
            shell.toast.show(`Archived as ${archivedRelativePath}`);
          }}
        />
      ) : null}
      <SettingsDialog
        open={shell.dialog === "settings"}
        onClose={() => shell.setDialog(null)}
        onApply={() => {
          shell.setDialog(null);
          shell.toast.show("Settings applied locally");
        }}
      />
      <Toast visible={shell.toast.visible}>{shell.toast.message}</Toast>
    </>
  );
}
