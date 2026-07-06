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
  recent?: boolean;
  archived?: boolean;
}): Promise<NotesPage> {
  const params = new URLSearchParams();
  if (options.cursor) params.set("cursor", options.cursor);
  if (options.sort) params.set("sort", options.sort);
  if (options.direction) params.set("direction", options.direction);
  if (options.folder) params.set("folder", options.folder);
  if (options.recent) params.set("recent", "true");
  if (options.archived) params.set("archived", "true");
  const query = params.size > 0 ? `?${params.toString()}` : "";
  return apiGet<NotesPage>(`/notes${query}`);
}

export interface FoldersResponse {
  folders: string[];
  counts: Record<string, number>;
  total: number;
  /* Notes modified within the server's 7-day window (round 2). */
  recent: number;
  /* Archived note count (round 2). */
  archived: number;
}

export function fetchFolders(): Promise<FoldersResponse> {
  return apiGet<FoldersResponse>("/folders");
}
