import type { ShellState } from "../../pages/useShellState";
import { CommandPalette } from "../ui/CommandPalette";
import { Toast } from "../ui/Toast";
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

  return (
    <>
      <CommandPalette
        open={shell.dialog === "command"}
        onClose={() => shell.setDialog(null)}
        groups={commands}
      />
      <NewNoteDialog
        open={shell.dialog === "new-note"}
        onClose={() => shell.setDialog(null)}
        onCreate={(filename) => {
          shell.setDialog(null);
          shell.toast.show(`${filename} created locally`);
        }}
      />
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
