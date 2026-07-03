import type { ShellState } from "../../pages/useShellState";
import { navigate } from "../../services/navigation";
import { saveNoteContent } from "../../services/contentApi";
import { useWorkspaceData } from "../../stores/workspaceData";
import { CommandPalette } from "../ui/CommandPalette";
import { ConfirmationDialog } from "../ui/ConfirmationDialog";
import { Toast } from "../ui/Toast";
import { ArchiveDialog } from "./ArchiveDialog";
import { MoveNotePanel } from "./MoveNotePanel";
import { NewNoteDialog } from "./NewNoteDialog";
import { SettingsDialog } from "./SettingsDialog";
import { buildShellCommands } from "./shellCommands";
import type { NoteMetadata } from "../../../shared/schemas/notes.js";

/*
 * Transient layers for the workspace shell: palette, dialogs, toast.
 * Create doubles as "Save as new note" for the source-missing conflict
 * (REQ-018): the preserved draft is written into the freshly created file,
 * never silently onto the stale path.
 */
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

  const openDocument = shell.editor.document;
  const refresh = () => void useWorkspaceData.getState().loadInitial();

  async function onCreated(note: NoteMetadata) {
    shell.setDialog(null);
    if (shell.editor.conflict === "source-missing" && shell.editor.draft) {
      // Adopt the preserved draft into the new file (WF-007 save-as-new).
      try {
        await saveNoteContent(note.noteKey, shell.editor.draft, note.versionToken, crypto.randomUUID());
      } catch {
        // Draft not adopted: stay on the conflicted note, draft preserved.
        shell.toast.show("Draft could not be saved into the new note. Your draft is still open.");
        refresh();
        return;
      }
      shell.toast.show(`Draft saved as ${note.filename}`);
      // Adopted: settle the stale editor state before the route switch.
      shell.editor.discardDraft();
    } else {
      shell.toast.show(`${note.filename} created`);
    }
    refresh();
    navigate(`/notes/${note.noteKey}`);
  }

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
        onCreated={(note) => void onCreated(note)}
      />
      {openDocument ? (
        <MoveNotePanel
          open={shell.dialog === "move-note"}
          noteKey={openDocument.noteKey}
          noteTitle={openDocument.title}
          folders={shell.folders}
          onClose={() => shell.setDialog(null)}
          onMoved={(note) => {
            shell.setDialog(null);
            refresh();
            shell.toast.show(`Moved to ${note.folder || "workspace root"}`);
            navigate(`/notes/${note.noteKey}`);
          }}
        />
      ) : null}
      {openDocument ? (
        <ArchiveDialog
          open={shell.dialog === "archive-note"}
          noteKey={openDocument.noteKey}
          noteTitle={openDocument.title}
          onClose={() => shell.setDialog(null)}
          onArchived={(archivedRelativePath) => {
            shell.setDialog(null);
            refresh();
            shell.toast.show(`Archived as ${archivedRelativePath}`);
            shell.editor.discardAndClose();
            navigate("/");
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
      <ConfirmationDialog
        open={shell.dialog === "confirm-reload"}
        title="Reload disk version?"
        details="Your draft will be replaced by the version on disk. This cannot be undone."
        tone="destructive"
        confirmLabel="Reload disk version"
        onConfirm={() => {
          shell.setDialog(null);
          void shell.editor.resolveReload();
        }}
        onClose={() => shell.setDialog(null)}
      />
      <ConfirmationDialog
        open={shell.editor.pendingNavigation !== null}
        title="Discard unsaved draft?"
        details="This draft cannot be saved right now. Leaving discards it; staying keeps it open so you can retry or resolve the conflict."
        tone="destructive"
        confirmLabel="Discard draft"
        cancelLabel="Stay on this note"
        onConfirm={() => void shell.editor.confirmPendingNavigation()}
        onClose={() => {
          const stayKey = shell.editor.noteKey;
          shell.editor.cancelPendingNavigation();
          if (stayKey) navigate(`/notes/${stayKey}`);
        }}
      />
      <Toast visible={shell.toast.visible}>{shell.toast.message}</Toast>
    </>
  );
}
