import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { noteMetadataSchema } from "../../shared/schemas/notes.js";
import { contentIndexStatusSchema } from "../../shared/schemas/search.js";
import { AtomicFileWriter } from "../filesystem/atomic-writer.js";

/*
 * Search index cache (MasterPrompt.md 2.8, REQ-024): cache/search-index-v1.json
 * persists the indexed entries (metadata + indexed content + budget status)
 * so warm startups rebuild the Orama index without re-reading every note.
 * Disposable: Zod + version validated, null on mismatch, atomic writes,
 * never a source of truth.
 */
const CACHE_FILENAME = "search-index-v1.json";
const CACHE_SCHEMA_VERSION = 1;

const cachedEntrySchema = z.object({
  metadata: noteMetadataSchema,
  content: z.string().nullable(),
  contentIndexStatus: contentIndexStatusSchema,
  truncated: z.boolean(),
});
export type CachedIndexEntry = z.infer<typeof cachedEntrySchema>;

const cacheFileSchema = z.object({
  schemaVersion: z.literal(CACHE_SCHEMA_VERSION),
  generatedAt: z.string(),
  entries: z.array(cachedEntrySchema),
});

export class SearchIndexCache {
  private readonly writer = new AtomicFileWriter();
  private readonly path: string;

  constructor(cacheDir: string) {
    this.path = join(cacheDir, CACHE_FILENAME);
  }

  async load(): Promise<CachedIndexEntry[] | null> {
    try {
      const parsed = cacheFileSchema.parse(JSON.parse(await readFile(this.path, "utf8")));
      return parsed.entries;
    } catch {
      return null;
    }
  }

  async save(entries: readonly CachedIndexEntry[]): Promise<void> {
    const payload = {
      schemaVersion: CACHE_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      entries,
    };
    await this.writer.write({
      absPath: this.path,
      relPath: `cache/${CACHE_FILENAME}`,
      bytes: Buffer.from(JSON.stringify(payload), "utf8"),
    });
  }
}
