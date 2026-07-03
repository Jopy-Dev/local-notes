import { useEffect, useRef, useState } from "react";
import type { EditorMode } from "../components/ui/EditorModeTabs";
import type { SaveStateKind } from "../components/ui/SaveState";

/*
 * Editor-pane mock state (Step 11 parity). Real note content, autosave, and
 * conflict handling replace this slice at Waves 5/6.
 */
const SAVE_SETTLE_MS = 900;

export interface EditorMockState {
  mode: EditorMode;
  setMode: (mode: EditorMode) => void;
  toggleSplit: () => void;
  focusMode: boolean;
  toggleFocusMode: () => void;
  saveState: SaveStateKind;
  title: string;
  setTitle: (value: string) => void;
  changeTitle: (value: string) => void;
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  conflictVisible: boolean;
  setConflictVisible: (visible: boolean) => void;
  handleEscape: (dialogOpen: boolean) => void;
}

export function useEditorMockState(onEnterFocusMode: () => void): EditorMockState {
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [mode, setMode] = useState<EditorMode>("split");
  const [focusMode, setFocusMode] = useState(false);
  const [saveState, setSaveState] = useState<SaveStateKind>("saved");
  const [title, setTitle] = useState("Local Notes architecture");
  const [menuOpen, setMenuOpen] = useState(false);
  const [conflictVisible, setConflictVisible] = useState(false);

  useEffect(() => () => clearTimeout(saveTimer.current), []);

  function changeTitle(value: string) {
    setTitle(value);
    clearTimeout(saveTimer.current);
    setSaveState("unsaved");
    saveTimer.current = setTimeout(() => setSaveState("saved"), SAVE_SETTLE_MS);
  }

  function toggleFocusMode() {
    onEnterFocusMode();
    setMenuOpen(false);
    setFocusMode((current) => !current);
  }

  function toggleSplit() {
    setMode((current) => (current === "split" ? "edit" : "split"));
  }

  function handleEscape(dialogOpen: boolean) {
    if (!dialogOpen && focusMode) setFocusMode(false);
    setMenuOpen(false);
  }

  return {
    mode,
    setMode,
    toggleSplit,
    focusMode,
    toggleFocusMode,
    saveState,
    title,
    setTitle,
    changeTitle,
    menuOpen,
    setMenuOpen,
    conflictVisible,
    setConflictVisible,
    handleEscape,
  };
}
