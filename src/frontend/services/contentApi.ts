import { apiGet, apiPutText } from "./api";
import type { NoteDocument, NoteMetadata } from "../../shared/schemas/notes.js";

// Note open/save API (MasterPrompt.md 5.2, WF-005/006).
export function loadNoteDocument(noteKey: string): Promise<NoteDocument> {
  return apiGet<NoteDocument>(`/notes/${noteKey}`);
}

export function saveNoteContent(
  noteKey: string,
  draft: string,
  expectedVersion: string,
  operationId: string,
): Promise<NoteMetadata> {
  return apiPutText<NoteMetadata>(`/notes/${noteKey}/content`, draft, {
    "If-Match": expectedVersion,
    "X-Operation-ID": operationId,
  });
}
