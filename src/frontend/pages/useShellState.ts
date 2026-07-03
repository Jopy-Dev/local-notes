import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { SplitLayout } from "../components/shell/EditorContent";
import type { EditorMode } from "../components/ui/EditorModeTabs";
import { copyPlainText, copyToClipboard } from "../editor/copy-actions";
import { navigate } from "../services/navigation";
import { getWorkspaceDisplayPath } from "../services/workspace";
import { useEditorData } from "../stores/editorData";
import { useDashboardData } from "./useDashboardData";
import type { DashboardData } from "./useDashboardData";
import { useShellHotkeys } from "./useShellHotkeys";
import { useToast } from "./useToast";

/*
 * Workspace-shell state container (SCREEN-001/002): live dashboard data +
 * the real editor store (Wave 5). Selecting a note navigates to
 * /notes/:noteKey; the route param drives which document is open.
 */
export type DialogKind =
  | "command"
  | "new-note"
  | "settings"
  | "move-note"
  | "archive-note"
  | "confirm-reload"
  | null;

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
  splitLayout: SplitLayout;
  cycleSplitLayout: () => void;
  focusMode: boolean;
  toggleFocusMode: () => void;
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  copyMarkdown: () => void;
  copyText: () => void;
  copyLocalPath: () => void;
  dialog: DialogKind;
  setDialog: (dialog: DialogKind) => void;
  focusSearch: () => void;
  editor: ReturnType<typeof useEditorData.getState>;
}

export function useShellState(routeNoteKey: string | null): ShellState {
  const toast = useToast();
  const searchRef = useRef<HTMLInputElement>(null);

  const [activeFolder, setActiveFolder] = useState("all");
  const [query, setQuery] = useState("");
  const [descending, setDescending] = useState(true);
  const [mode, setModeState] = useState<EditorMode>("edit");
  const [splitLayout, setSplitLayout] = useState<SplitLayout>("side");
  const [focusMode, setFocusMode] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialog, setDialog] = useState<DialogKind>(null);

  const dashboard = useDashboardData(query);
  const editor = useEditorData();

  // Route param owns which note is open (MasterPrompt.md 1.6). Both paths
  // settle or park an unsettled draft first (REQ-017).
  useEffect(() => {
    if (routeNoteKey) void useEditorData.getState().openNote(routeNoteKey);
    else void useEditorData.getState().closeNote();
  }, [routeNoteKey]);

  // REQ-017/018: closing the tab with an unsaved, failed, or conflicted
  // draft warns first — the draft lives only in memory.
  useEffect(() => {
    const dirty = editor.saveState !== "saved";
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [editor.saveState]);

  function selectNote(key: string) {
    navigate(`/notes/${key}`);
    const noteTitle = dashboard.findNoteTitle(key);
    if (noteTitle !== undefined) toast.show(`Opened ${noteTitle}`);
  }

  function focusSearch() {
    setDialog(null);
    if (window.location.pathname !== "/") navigate("/");
    requestAnimationFrame(() => searchRef.current?.focus());
  }

  function toggleFocusMode() {
    setDialog(null);
    setMenuOpen(false);
    setFocusMode((current) => !current);
  }

  // REQ-015: entering visual edit mode revalidates the current draft -
  // source-mode edits may have made the note source-only.
  function setMode(next: EditorMode) {
    if (next === "edit") useEditorData.getState().revalidateVisual();
    setModeState(next);
  }

  function toggleSplit() {
    setModeState((current) => (current === "split" ? "edit" : "split"));
  }

  function cycleSplitLayout() {
    setSplitLayout((current) =>
      current === "side" ? "preview-top" : current === "preview-top" ? "preview-bottom" : "side",
    );
  }

  // REQ-020: copy success and clipboard-denied failure both surface a toast.
  function copyWithToast(action: Promise<boolean>, successMessage: string) {
    void action.then((copied) =>
      toast.show(copied ? successMessage : "Copy failed - clipboard unavailable"),
    );
  }

  function copyMarkdown() {
    if (!editor.document) return;
    copyWithToast(copyToClipboard(editor.draft), "Markdown copied");
  }

  function copyText() {
    const document = editor.document;
    if (!document) return;
    copyWithToast(copyPlainText(editor.draft, document.noteKey, document.extension), "Text copied");
  }

  function copyLocalPath() {
    const document = editor.document;
    if (!document) return;
    const root = getWorkspaceDisplayPath();
    const path = root ? `${root}/${document.relativePath}` : document.relativePath;
    copyWithToast(copyToClipboard(path), "Local path copied");
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
    selectedNote: routeNoteKey ?? "",
    selectNote,
    query,
    setQuery,
    descending,
    toggleDirection,
    mode,
    setMode,
    toggleSplit,
    splitLayout,
    cycleSplitLayout,
    focusMode,
    toggleFocusMode,
    menuOpen,
    setMenuOpen,
    copyMarkdown,
    copyText,
    copyLocalPath,
    dialog,
    setDialog,
    focusSearch,
    editor,
  };
}
