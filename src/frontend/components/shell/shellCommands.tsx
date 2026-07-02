import { FocusEnterIcon, NewNoteIcon, SearchIcon, SettingsIcon, SplitViewIcon } from "../icons";
import type { CommandEntry } from "../ui/CommandPalette";

/*
 * Static command palette entries for the app-shell parity screen.
 * Real command registry (note-title search, recents) lands at Step 12+.
 */
interface ShellCommandHandlers {
  createNote: () => void;
  focusSearch: () => void;
  toggleSplit: () => void;
  toggleFocusMode: () => void;
  openSettings: () => void;
}

export function buildShellCommands(handlers: ShellCommandHandlers): readonly {
  label: string;
  commands: readonly CommandEntry[];
}[] {
  return [
    {
      label: "Actions",
      commands: [
        {
          key: "create",
          label: "Create new note",
          shortcut: "Ctrl N",
          icon: <NewNoteIcon size={15} />,
          onRun: handlers.createNote,
        },
        {
          key: "search",
          label: "Search all notes",
          shortcut: "Ctrl P",
          icon: <SearchIcon size={15} />,
          onRun: handlers.focusSearch,
        },
        {
          key: "split",
          label: "Toggle split view",
          shortcut: "Ctrl \\",
          icon: <SplitViewIcon size={15} />,
          onRun: handlers.toggleSplit,
        },
        {
          key: "focus",
          label: "Toggle focus mode",
          shortcut: "Ctrl Shift F",
          icon: <FocusEnterIcon size={15} />,
          onRun: handlers.toggleFocusMode,
        },
        {
          key: "settings",
          label: "Open settings",
          shortcut: "Ctrl ,",
          icon: <SettingsIcon size={15} />,
          onRun: handlers.openSettings,
        },
      ],
    },
  ];
}
