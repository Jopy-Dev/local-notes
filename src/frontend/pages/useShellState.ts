import { useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import type { SplitLayout } from "../components/shell/EditorContent";
import type { EditorMode } from "../components/ui/EditorModeTabs";
import type { FindController } from "../components/ui/FindInNoteBar";
import { copyPlainText, copyToClipboard, markdownForClipboard } from "../editor/copy-actions";
import { closeSettingsRoute, navigate, openSettingsRoute } from "../services/navigation";
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
  | "move-note"
  | "archive-note"
  | "confirm-reload"
  | null;

export interface ShellState extends DashboardData {
  toast: ReturnType<typeof useToast>;
  searchRef: RefObject<HTMLInputElement | null>;
  settingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;
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
  find: FindController;
  openFind: () => void;
  dialog: DialogKind;
  setDialog: (dialog: DialogKind) => void;
  focusSearch: () => void;
  editor: ReturnType<typeof useEditorData.getState>;
}

export function useShellState(
  routeNoteKey: string | null,
  settingsOpen = false,
  archiveNoteKey: string | null = null,
): ShellState {
  const toast = useToast();
  const searchRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [mode, setModeState] = useState<EditorMode>("source");
  const [splitLayout, setSplitLayout] = useState<SplitLayout>("side");
  const [focusMode, setFocusMode] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialog, setDialog] = useState<DialogKind>(null);

  const dashboard = useDashboardData(query);
  const editor = useEditorData();

  // REQ-035 find-in-note: client-side only, scoped to the open note.
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [findCase, setFindCase] = useState(false);
  const [findIndex, setFindIndex] = useState(0);
  const [findTotal, setFindTotal] = useState(0);
  // Escape restores focus to where find was invoked from (Design_System 11).
  const findReturnFocus = useRef<HTMLElement | null>(null);

  // Route param owns which note is open (MasterPrompt.md 1.6). Both paths
  // settle or park an unsettled draft first (REQ-017).
  useEffect(() => {
    if (routeNoteKey) void useEditorData.getState().openNote(routeNoteKey);
    else void useEditorData.getState().closeNote();
    // A different note is a different find context.
    setFindOpen(false);
    setFindQuery("");
    setFindIndex(0);
    setFindTotal(0);
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
    // Archive scope lists archive-tree keys; they open on the read-only
    // archive route, never /notes (round 2, SCREEN-008).
    navigate(dashboard.folder === "archive" ? `/archive/${key}` : `/notes/${key}`);
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

  function setMode(next: EditorMode) {
    setModeState(next);
  }

  function toggleSplit() {
    setModeState((current) => (current === "split" ? "source" : "split"));
  }

  function cycleSplitLayout() {
    setSplitLayout((current) =>
      current === "side" ? "preview-top" : current === "preview-top" ? "preview-bottom" : "side",
    );
  }

  // PRD REQ-035: find unavailable until the note's content loads.
  function openFind() {
    if (!editor.document) return;
    findReturnFocus.current = window.document.activeElement as HTMLElement | null;
    setFindOpen(true);
  }

  function closeFind() {
    setFindOpen(false);
    setFindQuery("");
    setFindIndex(0);
    setFindTotal(0);
    if (findReturnFocus.current?.isConnected) findReturnFocus.current.focus();
    findReturnFocus.current = null;
  }

  const find: FindController = {
    open: findOpen,
    query: findQuery,
    caseSensitive: findCase,
    activeIndex: findIndex,
    total: findTotal,
    request: useMemo(
      () =>
        findOpen && findQuery.trim() !== ""
          ? { query: findQuery, activeIndex: findIndex, caseSensitive: findCase }
          : null,
      [findOpen, findQuery, findIndex, findCase],
    ),
    onQueryChange: (query) => {
      setFindQuery(query);
      setFindIndex(0);
    },
    onToggleCase: () => {
      setFindCase((current) => !current);
      setFindIndex(0);
    },
    onNext: () => setFindIndex((index) => (findTotal > 0 ? (index + 1) % findTotal : 0)),
    onPrevious: () =>
      setFindIndex((index) => (findTotal > 0 ? (index - 1 + findTotal) % findTotal : 0)),
    onClose: closeFind,
    onMatches: (total) => {
      setFindTotal(total);
      setFindIndex((index) => (total === 0 ? 0 : Math.min(index, total - 1)));
    },
  };

  // REQ-020: copy success and clipboard-denied failure both surface a toast.
  function copyWithToast(action: Promise<boolean>, successMessage: string) {
    void action.then((copied) =>
      toast.show(copied ? successMessage : "Copy failed - clipboard unavailable"),
    );
  }

  function copyMarkdown() {
    if (!editor.document) return;
    copyWithToast(copyToClipboard(markdownForClipboard(editor.draft)), "Markdown copied");
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

  // WF-004/REQ-008: sort lives in the workspace store - persisted config
  // restores across restarts, the store refetches sorted pages + rolls back.
  const descending = dashboard.sortDirection === "desc";
  function toggleDirection() {
    const next = !descending;
    toast.show(next ? "Sorted descending" : "Sorted ascending");
    dashboard.setSortDirection(next ? "desc" : "asc");
  }

  useShellHotkeys({
    openCommand: () => setDialog("command"),
    focusSearch,
    openNewNote: () => setDialog("new-note"),
    openSettings: openSettingsRoute,
    toggleSplit,
    toggleFocusMode,
    openFind,
    onEscape: () => {
      setMenuOpen(false);
      // Escape closes the innermost transient layer first (Design_System 11):
      // dialogs own their Escape; find closes before focus mode exits.
      if (dialog === null && findOpen) {
        closeFind();
        return;
      }
      if (dialog === null && focusMode) setFocusMode(false);
    },
  });

  return {
    ...dashboard,
    toast,
    searchRef,
    settingsOpen,
    openSettings: openSettingsRoute,
    closeSettings: closeSettingsRoute,
    // WF-001 folder navigation lives in the workspace store (scoped fetches).
    activeFolder: dashboard.folder,
    setActiveFolder: dashboard.setFolder,
    selectedNote: routeNoteKey ?? archiveNoteKey ?? "",
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
    find,
    openFind,
    dialog,
    setDialog,
    focusSearch,
    editor,
  };
}
