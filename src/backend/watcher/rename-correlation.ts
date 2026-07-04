import type { WatchEvent } from "./workspace-watcher.js";
import type { NoteMetadata } from "../../shared/schemas/notes.js";

/*
 * REQ-018 rename correlation: an external rename surfaces as unlink+add in
 * the same coalesced batch. A removed note whose size and mtime both match
 * an added file is the same file under a new path (rename preserves both);
 * each removed event pairs with at most one added event. Pairs collapse to
 * one note.renamed event in the watch pipeline instead of removed+added.
 */
export interface RenamePair {
  oldPath: string;
  newPath: string;
  note: NoteMetadata;
}

export function correlateRenames(
  events: WatchEvent[],
  previous: Map<string, NoteMetadata>,
  current: Map<string, NoteMetadata>,
): { renames: RenamePair[]; remainder: WatchEvent[] } {
  const added = events.filter((event) => event.kind === "added");
  const renames: RenamePair[] = [];
  const paired = new Set<WatchEvent>();
  for (const gone of events) {
    if (gone.kind !== "removed") continue;
    const old = previous.get(gone.relPath);
    if (!old) continue;
    for (const candidate of added) {
      if (paired.has(candidate)) continue;
      const note = current.get(candidate.relPath);
      if (!note || note.sizeBytes !== old.sizeBytes || note.modifiedAt !== old.modifiedAt) continue;
      paired.add(candidate);
      paired.add(gone);
      renames.push({ oldPath: gone.relPath, newPath: candidate.relPath, note });
      break;
    }
  }
  const remainder = events.filter((event) => !paired.has(event));
  return { renames, remainder };
}
