import { useRef, useState } from "react";
import type { RefObject } from "react";
import { useDashboardData } from "./useDashboardData";
import type { DashboardData } from "./useDashboardData";
import { useEditorMockState } from "./useEditorMockState";
import type { EditorMockState } from "./useEditorMockState";
import { useShellHotkeys } from "./useShellHotkeys";
import { useToast } from "./useToast";

/*
 * Workspace-shell state container composing the dashboard data slice (live,
 * Wave 2) and the editor mock slice (replaced at Waves 5/6).
 */
export type DialogKind = "command" | "new-note" | "settings" | null;

export interface ShellState extends DashboardData, Omit<EditorMockState, "setTitle" | "handleEscape"> {
  toast: ReturnType<typeof useToast>;
  searchRef: RefObject<HTMLInputElement | null>;
  activeFolder: string;
  setActiveFolder: (key: string) => void;
  selectedNote: string;
  selectNote: (key: string) => void;
  query: string;
  setQuery: (value: string) => void;
  descending: boolean;
  toggleDirection: () => void;
  dialog: DialogKind;
  setDialog: (dialog: DialogKind) => void;
  focusSearch: () => void;
}

export function useShellState(): ShellState {
  const toast = useToast();
  const searchRef = useRef<HTMLInputElement>(null);

  const [activeFolder, setActiveFolder] = useState("all");
  const [selectedNote, setSelectedNote] = useState("architecture");
  const [query, setQuery] = useState("");
  const [descending, setDescending] = useState(true);
  const [dialog, setDialog] = useState<DialogKind>(null);

  const dashboard = useDashboardData(query);
  const editor = useEditorMockState(() => setDialog(null));

  function selectNote(key: string) {
    setSelectedNote(key);
    const noteTitle = dashboard.findNoteTitle(key);
    if (noteTitle !== undefined) {
      editor.setTitle(noteTitle);
      toast.show(`Opened ${noteTitle}`);
    }
  }

  function focusSearch() {
    setDialog(null);
    requestAnimationFrame(() => searchRef.current?.focus());
  }

  function toggleDirection() {
    setDescending((current) => !current);
    toast.show(descending ? "Sorted ascending" : "Sorted descending");
  }

  useShellHotkeys({
    openCommand: () => setDialog("command"),
    focusSearch,
    openNewNote: () => setDialog("new-note"),
    openSettings: () => setDialog("settings"),
    toggleSplit: editor.toggleSplit,
    toggleFocusMode: editor.toggleFocusMode,
    onEscape: () => editor.handleEscape(dialog !== null),
  });

  return {
    ...dashboard,
    ...editor,
    toast,
    searchRef,
    activeFolder,
    setActiveFolder,
    selectedNote,
    selectNote,
    query,
    setQuery,
    descending,
    toggleDirection,
    dialog,
    setDialog,
    focusSearch,
  };
}
