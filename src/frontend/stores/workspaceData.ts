import { create } from "zustand";
import { fetchFolders, fetchNotesPage } from "../services/notesApi";
import { subscribeWorkspaceEvents } from "../services/events";
import { useEditorData } from "./editorData";
import { useSearchData } from "./searchData";
import { indexStateSchema } from "../../shared/schemas/search.js";
import type { NoteMetadata } from "../../shared/schemas/notes.js";

/*
 * Dashboard data store (WF-001/004): appended metadata pages, folder tree,
 * live refresh on SSE note events. View/sort preferences persist via the
 * settings API at Wave 7 - session-local until then.
 */
export type DashboardView = "list" | "card";

interface WorkspaceDataState {
  notes: NoteMetadata[];
  total: number;
  nextCursor: string | null;
  folders: string[];
  loading: boolean;
  loaded: boolean;
  error: string | null;
  view: DashboardView;
  setView: (view: DashboardView) => void;
  loadInitial: () => Promise<void>;
  loadMore: () => Promise<void>;
  connectEvents: () => () => void;
}

export const useWorkspaceData = create<WorkspaceDataState>((set, get) => ({
  notes: [],
  total: 0,
  nextCursor: null,
  folders: [],
  loading: false,
  loaded: false,
  error: null,
  view: "list",

  setView: (view) => set({ view }),

  loadInitial: async () => {
    set({ loading: true, error: null });
    try {
      const [page, folderData] = await Promise.all([fetchNotesPage({}), fetchFolders()]);
      set({
        notes: page.notes,
        total: page.total,
        nextCursor: page.nextCursor,
        folders: folderData.folders,
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
    const page = await fetchNotesPage({ cursor: nextCursor });
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
        useEditorData.getState().handleEvent({
          type: event.type,
          ...(typeof event.payload.noteKey === "string" ? { noteKey: event.payload.noteKey } : {}),
          ...(typeof event.payload.version === "string" ? { version: event.payload.version } : {}),
          ...(typeof event.payload.operationId === "string"
            ? { operationId: event.payload.operationId }
            : {}),
        });
      } else if (event.type === "index.status") {
        const parsed = indexStateSchema.safeParse(event.payload.status);
        if (parsed.success) useSearchData.getState().setIndexState(parsed.data);
      }
    });
  },
}));
