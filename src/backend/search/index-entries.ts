import type { NoteMetadata } from "../../shared/schemas/notes.js";
import type { IndexableContent } from "./search-content.js";
import type { CachedIndexEntry } from "./search-index-cache.js";
import type { RebuildEntry } from "./search-index.js";

/*
 * Index entry assembly (MasterPrompt.md 4.3 startup reconciliation): warm
 * cache entries with a matching versionToken reuse their indexed content;
 * changed or new notes re-read from disk through the caller's path-guarded
 * reader.
 */
export async function buildIndexEntries(
  notes: readonly NoteMetadata[],
  contentFor: (note: NoteMetadata) => Promise<IndexableContent>,
  warm?: ReadonlyMap<string, CachedIndexEntry>,
): Promise<RebuildEntry[]> {
  return Promise.all(
    notes.map(async (note) => {
      const cached = warm?.get(note.noteKey);
      if (cached && cached.metadata.versionToken === note.versionToken) {
        return {
          metadata: note,
          content: cached.contentIndexStatus === "full" ? cached.content : null,
          truncated: cached.truncated,
        };
      }
      const read = await contentFor(note);
      return { metadata: note, content: read.content, truncated: read.truncated };
    }),
  );
}
