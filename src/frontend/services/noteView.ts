import type { NoteMetadata } from "../../shared/schemas/notes.js";

// View model consumed by <NoteListItem>.
export interface NoteListEntry {
  key: string;
  title: string;
  time: string;
  preview: string;
  fileType: "MD" | "TXT";
  path: string;
  metadataOnly?: boolean;
}

/*
 * Presentation mappers: NoteMetadata -> list/card entry (REQ-007 fields).
 * metadataOnly stays false until the search index reports truncation (Wave 3).
 */
export function formatNoteTime(modifiedAt: string, now: Date = new Date()): string {
  const stamp = new Date(modifiedAt);
  const sameDay = stamp.toDateString() === now.toDateString();
  if (sameDay) {
    return stamp.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (stamp.toDateString() === yesterday.toDateString()) return "Yesterday";
  return stamp.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function toListEntry(note: NoteMetadata, now: Date = new Date()): NoteListEntry {
  return {
    key: note.noteKey,
    title: note.title,
    time: formatNoteTime(note.modifiedAt, now),
    preview: note.preview,
    fileType: note.extension === ".md" ? "MD" : "TXT",
    path: note.folder,
  };
}

export function folderCounts(notes: readonly NoteMetadata[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const note of notes) {
    if (!note.folder) continue;
    counts.set(note.folder, (counts.get(note.folder) ?? 0) + 1);
  }
  return counts;
}
