import { apiGet } from "./api";
import type { NoteMetadata } from "../../shared/schemas/notes.js";

// Notes/folders read API (MasterPrompt.md 5.2). Pages append client-side and
// virtualize; no user-facing pagination (REQ-005).
export interface NotesPage {
  notes: NoteMetadata[];
  total: number;
  nextCursor: string | null;
}

export function fetchNotesPage(options: {
  cursor?: string;
  sort?: string;
  direction?: string;
  folder?: string;
}): Promise<NotesPage> {
  const params = new URLSearchParams();
  if (options.cursor) params.set("cursor", options.cursor);
  if (options.sort) params.set("sort", options.sort);
  if (options.direction) params.set("direction", options.direction);
  if (options.folder) params.set("folder", options.folder);
  const query = params.size > 0 ? `?${params.toString()}` : "";
  return apiGet<NotesPage>(`/notes${query}`);
}

export interface FoldersResponse {
  folders: string[];
  counts: Record<string, number>;
  total: number;
}

export function fetchFolders(): Promise<FoldersResponse> {
  return apiGet<FoldersResponse>("/folders");
}
