import { useEffect } from "react";
import type { NoteListEntry } from "../components/ui/NoteListItem";
import { toListEntry } from "../services/noteView";
import { useSearchData } from "../stores/searchData";
import type { SearchStatus } from "../stores/searchData";
import { useSettingsData } from "../stores/settingsData";
import { useWorkspaceData } from "../stores/workspaceData";
import type { DashboardSortBy, DashboardSortDirection, DashboardView } from "../stores/workspaceData";
import type { IndexState, SearchResult } from "../../shared/schemas/search.js";

/*
 * Dashboard data slice (WF-001/002/004): live notes/folders from the
 * workspace store; non-blank queries run ranked search (REQ-009) with a
 * 150ms debounce and stale-request abort. Blank query = current sorted
 * collection.
 */
const SEARCH_DEBOUNCE_MS = 150;

export interface DashboardData {
  dataLoading: boolean;
  totalLabel: string;
  hasMore: boolean;
  loadMore: () => void;
  view: DashboardView;
  setView: (view: DashboardView) => void;
  folder: string;
  setFolder: (folder: string) => void;
  sortBy: DashboardSortBy;
  setSortBy: (sortBy: DashboardSortBy) => void;
  sortDirection: DashboardSortDirection;
  setSortDirection: (direction: DashboardSortDirection) => void;
  folders: readonly string[];
  folderCountMap: ReadonlyMap<string, number>;
  totalNotes: number;
  filteredNotes: readonly NoteListEntry[];
  findNoteTitle: (key: string) => string | undefined;
  searchStatus: SearchStatus;
  searchResults: readonly SearchResult[];
  searchHasMore: boolean;
  loadMoreResults: () => void;
  indexState: IndexState;
}

export function useDashboardData(query: string): DashboardData {
  const data = useWorkspaceData();
  const search = useSearchData();
  // Reactive fallback: session sort override wins, else persisted config.
  const settingsConfig = useSettingsData((state) => state.config);

  // Initial load + SSE-driven refresh; store actions are referentially
  // stable, so this runs once on mount.
  useEffect(() => {
    void data.loadInitial();
    return data.connectEvents();
  }, []);

  // Debounced ranked search; blank query returns to the sorted collection.
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      useSearchData.getState().clear();
      return;
    }
    const timer = setTimeout(() => {
      void useSearchData.getState().run(trimmed);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const searching = query.trim().length > 0;
  const notes = data.notes.map((note) => toListEntry(note));

  return {
    dataLoading: data.loading && !data.loaded,
    totalLabel: searching
      ? `${search.total} result${search.total === 1 ? "" : "s"}`
      : `${data.total} note${data.total === 1 ? "" : "s"}`,
    hasMore: data.nextCursor !== null,
    loadMore: () => void data.loadMore(),
    view: data.view,
    setView: data.setView,
    sortBy: data.sortBy ?? settingsConfig?.sortBy ?? "modified",
    setSortBy: data.setSortBy,
    sortDirection: data.sortDirection ?? settingsConfig?.sortDirection ?? "desc",
    setSortDirection: data.setSortDirection,
    folder: data.folder,
    setFolder: data.setFolder,
    folders: data.folders,
    // Counts + workspace total come from /folders - the notes page may be
    // folder-scoped and would undercount (WF-001).
    folderCountMap: new Map(Object.entries(data.folderCounts)),
    totalNotes: data.workspaceTotal,
    filteredNotes: notes,
    findNoteTitle: (key) =>
      data.notes.find((candidate) => candidate.noteKey === key)?.title ??
      search.results.find((candidate) => candidate.noteKey === key)?.title,
    searchStatus: search.status,
    searchResults: search.results,
    searchHasMore: search.hasMore,
    loadMoreResults: () => void search.loadMore(),
    indexState: search.indexState,
  };
}
