import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { EditorMode } from "../components/ui/EditorModeTabs";
import type { SaveStateKind } from "../components/ui/SaveState";
import { useDashboardData } from "./useDashboardData";
import type { DashboardData } from "./useDashboardData";
import { useShellHotkeys } from "./useShellHotkeys";
import { useToast } from "./useToast";

/*
 * Workspace-shell state container. Dashboard data is live (Wave 2 via
 * useDashboardData); editor content stays mock until Waves 5/6.
 */
const SAVE_SETTLE_MS = 900;
export type DialogKind = "command" | "new-note" | "settings" | null;

export interface ShellState extends DashboardData {
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
  mode: EditorMode;
  setMode: (mode: EditorMode) => void;
  toggleSplit: () => void;
  focusMode: boolean;
  toggleFocusMode: () => void;
  saveState: SaveStateKind;
  title: string;
  changeTitle: (value: string) => void;
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  conflictVisible: boolean;
  setConflictVisible: (visible: boolean) => void;
  dialog: DialogKind;
  setDialog: (dialog: DialogKind) => void;
  focusSearch: () => void;
}

export function useShellState(): ShellState {
  const toast = useToast();
  const searchRef = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [activeFolder, setActiveFolder] = useState("all");
  const [selectedNote, setSelectedNote] = useState("architecture");
  const [query, setQuery] = useState("");
  const [descending, setDescending] = useState(true);
  const [mode, setMode] = useState<EditorMode>("split");
  const [focusMode, setFocusMode] = useState(false);
  const [saveState, setSaveState] = useState<SaveStateKind>("saved");
  const [title, setTitle] = useState("Local Notes architecture");
  const [menuOpen, setMenuOpen] = useState(false);
  const [conflictVisible, setConflictVisible] = useState(false);
  const [dialog, setDialog] = useState<DialogKind>(null);

  useEffect(() => () => clearTimeout(saveTimer.current), []);

  const dashboard = useDashboardData(query);

  function changeTitle(value: string) {
    setTitle(value);
    clearTimeout(saveTimer.current);
    setSaveState("unsaved");
    saveTimer.current = setTimeout(() => setSaveState("saved"), SAVE_SETTLE_MS);
  }

  function selectNote(key: string) {
    setSelectedNote(key);
    const noteTitle = dashboard.findNoteTitle(key);
    if (noteTitle !== undefined) {
      setTitle(noteTitle);
      toast.show(`Opened ${noteTitle}`);
    }
  }

  function focusSearch() {
    setDialog(null);
    requestAnimationFrame(() => searchRef.current?.focus());
  }

  function toggleFocusMode() {
    setDialog(null);
    setMenuOpen(false);
    setFocusMode((current) => !current);
  }

  function toggleSplit() {
    setMode((current) => (current === "split" ? "edit" : "split"));
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
    toggleSplit,
    toggleFocusMode,
    onEscape: () => {
      if (dialog === null && focusMode) setFocusMode(false);
      setMenuOpen(false);
    },
  });

  return {
    ...dashboard,
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
    mode,
    setMode,
    toggleSplit,
    focusMode,
    toggleFocusMode,
    saveState,
    title,
    changeTitle,
    menuOpen,
    setMenuOpen,
    conflictVisible,
    setConflictVisible,
    dialog,
    setDialog,
    focusSearch,
  };
}
