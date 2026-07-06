import { apiGet, apiPostText, apiPutText } from "./api";
import type { NoteDocument, NoteMetadata } from "../../shared/schemas/notes.js";

export interface RenderedPreview {
  html: string;
}

// Note open/save API (MasterPrompt.md 5.2, WF-005/006).
export function loadNoteDocument(noteKey: string): Promise<NoteDocument> {
  return apiGet<NoteDocument>(`/notes/${noteKey}`);
}

// Server-sanitized preview (MasterPrompt.md 4.6): the only HTML the preview
// component may render. X-Note-Key anchors relative link/image resolution.
export function renderMarkdownPreview(
  source: string,
  noteKey: string,
  signal?: AbortSignal,
): Promise<RenderedPreview> {
  return apiPostText<RenderedPreview>(
    "/markdown/render",
    source,
    { "X-Note-Key": noteKey },
    { signal },
  );
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
