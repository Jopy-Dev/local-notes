import { apiDelete, apiGet, apiPost } from "./api";
import type { NoteDocument, NoteMetadata } from "../../shared/schemas/notes.js";

/*
 * Archive API (round 2, SCREEN-008): read-only archived content, restore
 * into an active folder, delete to the OS recycle bin (ADR-009). Keys are
 * archive-root-relative - never interchangeable with active note keys.
 */
export function loadArchivedNote(noteKey: string): Promise<NoteDocument> {
  return apiGet<NoteDocument>(`/archive/${noteKey}`);
}

export function restoreArchivedNote(
  noteKey: string,
  destinationFolderKey: string,
): Promise<NoteMetadata> {
  return apiPost<NoteMetadata>(`/archive/${noteKey}/restore`, {
    destinationFolderKey,
    operationId: crypto.randomUUID(),
  });
}

export function deleteArchivedNote(noteKey: string): Promise<{ deleted: boolean }> {
  return apiDelete<{ deleted: boolean }>(`/archive/${noteKey}`);
}
