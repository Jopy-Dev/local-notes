import { create } from "zustand";
import { fetchFolders, fetchNotesPage } from "../services/notesApi";
import { subscribeWorkspaceEvents } from "../services/events";
import { useEditorData } from "./editorData";
import { useSearchData } from "./searchData";
import { useSettingsData } from "./settingsData";
import { effectiveSort, persistPreference } from "./workspace-preferences";
import { indexStateSchema } from "../../shared/schemas/search.js";
import type { ConfigV1 } from "../../shared/schemas/config.js";
import type { NoteMetadata } from "../../shared/schemas/notes.js";

/*
 * Dashboard data store (WF-001/004): appended metadata pages, folder tree,
 * live refresh on SSE note events. Sort preferences persist through the
 * settings API (REQ-008) optimistically - failure rolls the change back.
 */
export type DashboardSortBy = ConfigV1["sortBy"];
export type DashboardSortDirection = ConfigV1["sortDirection"];

interface WorkspaceDataState {
  notes: NoteMetadata[];
  total: number;
  nextCursor: string | null;
  folders: string[];
  /* Direct-folder note counts + workspace/recent totals from /folders
   * (WF-001) - never derived from a folder-scoped notes page. */
  folderCounts: Record<string, number>;
  workspaceTotal: number;
  recentTotal: number;
  loading: boolean;
  loaded: boolean;
  error: string | null;
  /* "all" = unscoped; otherwise a folder path from the tree. Session-only. */
  folder: string;
  /* null = not user-changed this session; falls back to persisted config. */
  sortBy: DashboardSortBy | null;
  sortDirection: DashboardSortDirection | null;
  setFolder: (folder: string) => void;
  setSortBy: (sortBy: DashboardSortBy) => void;
  setSortDirection: (direction: DashboardSortDirection) => void;
  loadInitial: () => Promise<void>;
  loadMore: () => Promise<void>;
  connectEvents: () => () => void;
}

/* Fetch params for the active scope: "all" = unscoped, "recent" = the
 * server's 7-day modified window, anything else = a folder path. */
function scopeParams(state: { folder: string } & Parameters<typeof effectiveSort>[0]) {
  const scope =
    state.folder === "all"
      ? {}
      : state.folder === "recent"
        ? { recent: true }
        : { folder: state.folder };
  return { ...effectiveSort(state), ...scope };
}

export const useWorkspaceData = create<WorkspaceDataState>((set, get) => ({
  notes: [],
  total: 0,
  nextCursor: null,
  folders: [],
  folderCounts: {},
  workspaceTotal: 0,
  recentTotal: 0,
  loading: false,
  loaded: false,
  error: null,
  folder: "all",
  sortBy: null,
  sortDirection: null,

  setFolder: (folder) => {
    if (get().folder === folder) return;
    set({ folder });
    void get().loadInitial();
  },

  setSortBy: (sortBy) => {
    const previous = get().sortBy;
    persistPreference({
      update: { sortBy },
      apply: () => set({ sortBy }),
      rollback: () => set({ sortBy: previous }),
      refetch: () => void get().loadInitial(),
    });
  },

  setSortDirection: (direction) => {
    const previous = get().sortDirection;
    persistPreference({
      update: { sortDirection: direction },
      apply: () => set({ sortDirection: direction }),
      rollback: () => set({ sortDirection: previous }),
      refetch: () => void get().loadInitial(),
    });
  },

  loadInitial: async () => {
    set({ loading: true, error: null });
    try {
      const [page, folderData] = await Promise.all([
        fetchNotesPage(scopeParams(get())),
        fetchFolders(),
      ]);
      set({
        notes: page.notes,
        total: page.total,
        nextCursor: page.nextCursor,
        folders: folderData.folders,
        folderCounts: folderData.counts,
        workspaceTotal: folderData.total,
        recentTotal: folderData.recent,
        loading: false,
        loaded: true,
      });
    } catch {
      set({ loading: false, loaded: true, error: "Could not load notes from the local server." });
    }
  },

  loadMore: async () => {
    const { nextCursor, notes } = get();
    if (!nextCursor) return;
    const page = await fetchNotesPage({ cursor: nextCursor, ...scopeParams(get()) });
    // Dedupe by key across appended pages (WF-001 pass condition).
    const seen = new Set(notes.map((note) => note.noteKey));
    const appended = page.notes.filter((note) => !seen.has(note.noteKey));
    set({ notes: [...notes, ...appended], nextCursor: page.nextCursor, total: page.total });
  },

  connectEvents: () => {
    return subscribeWorkspaceEvents((event) => {
      if (event.type.startsWith("note.")) {
        void get().loadInitial();
        // Open-editor conflict detection (WF-007): the controller suppresses
        // events that carry one of its own operation IDs.
        useEditorData.getState().handleEvent(toEditorEvent(event));
      } else if (event.type === "index.status") {
        const parsed = indexStateSchema.safeParse(event.payload.status);
        if (parsed.success) useSearchData.getState().setIndexState(parsed.data);
      } else if (event.type === "settings.changed") {
        void useSettingsData.getState().reload();
      }
    });
  },
}));

function toEditorEvent(event: { type: string; payload: Record<string, unknown> }) {
  const field = (key: string) =>
    typeof event.payload[key] === "string" ? { [key]: event.payload[key] as string } : {};
  return {
    type: event.type,
    ...field("noteKey"),
    ...field("oldKey"),
    ...field("version"),
    ...field("operationId"),
  };
}
