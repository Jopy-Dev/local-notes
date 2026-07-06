import { apiPost } from "./api";
import type { NoteMetadata } from "../../shared/schemas/notes.js";
import type { NoteExtension } from "../../shared/schemas/notes.js";

/*
 * Mutation API (MasterPrompt.md 5.2, WF-003/008/009). Move/archive generate
 * the operation ID here so the watcher's SSE echo of our own write carries
 * it (self-event suppression, 4.5).
 */
export function createNote(input: {
  filename: string;
  extension: NoteExtension;
  folderKey: string;
}): Promise<NoteMetadata> {
  return apiPost<NoteMetadata>("/notes", input);
}

export function moveNote(noteKey: string, destinationFolderKey: string): Promise<NoteMetadata> {
  return apiPost<NoteMetadata>(`/notes/${noteKey}/move`, {
    destinationFolderKey,
    operationId: crypto.randomUUID(),
  });
}

export function archiveNote(
  noteKey: string,
  replacementFilename?: string,
): Promise<{ archivedRelativePath: string }> {
  return apiPost<{ archivedRelativePath: string }>(`/notes/${noteKey}/archive`, {
    ...(replacementFilename !== undefined ? { replacementFilename } : {}),
    operationId: crypto.randomUUID(),
  });
}
