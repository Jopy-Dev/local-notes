import { useEffect } from "react";
import type { NoteListEntry } from "../components/ui/NoteListItem";
import { folderCounts, toListEntry } from "../services/noteView";
import { useWorkspaceData } from "../stores/workspaceData";
import type { DashboardView } from "../stores/workspaceData";

/*
 * Dashboard data slice (WF-001/004): live notes/folders from the workspace
 * store, filtered client-side until ranked search lands at Wave 3.
 */
export interface DashboardData {
  dataLoading: boolean;
  totalLabel: string;
  hasMore: boolean;
  loadMore: () => void;
  view: DashboardView;
  setView: (view: DashboardView) => void;
  folders: readonly string[];
  folderCountMap: ReadonlyMap<string, number>;
  totalNotes: number;
  filteredNotes: readonly NoteListEntry[];
  findNoteTitle: (key: string) => string | undefined;
}

export function useDashboardData(query: string): DashboardData {
  const data = useWorkspaceData();

  // Initial load + SSE-driven refresh; store actions are referentially
  // stable, so this runs once on mount.
  useEffect(() => {
    void data.loadInitial();
    return data.connectEvents();
  }, []);

  // Interim client-side filter over loaded metadata; ranked full-text search
  // (REQ-009) replaces this at Wave 3.
  const needle = query.trim().toLocaleLowerCase();
  const matching = data.notes.filter((note) => {
    const text = `${note.title} ${note.preview}`.toLocaleLowerCase();
    return !needle || text.includes(needle);
  });
  const filteredNotes = matching.map((note) => toListEntry(note));

  return {
    dataLoading: data.loading && !data.loaded,
    totalLabel: query
      ? `${filteredNotes.length} result${filteredNotes.length === 1 ? "" : "s"}`
      : `${data.total} note${data.total === 1 ? "" : "s"}`,
    hasMore: data.nextCursor !== null,
    loadMore: () => void data.loadMore(),
    view: data.view,
    setView: data.setView,
    folders: data.folders,
    folderCountMap: folderCounts(data.notes),
    totalNotes: data.total,
    filteredNotes,
    findNoteTitle: (key) =>
      data.notes.find((candidate) => candidate.noteKey === key)?.title,
  };
}
