import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { noteMetadataSchema } from "../../shared/schemas/notes.js";
import type { NoteMetadata } from "../../shared/schemas/notes.js";
import { AtomicFileWriter } from "./atomic-writer.js";

/*
 * Metadata cache (MasterPrompt.md 2.8, REQ-024): cache/metadata-v1.json holds
 * schema version + generated time + entries. Loaded only after Zod + version
 * validation; any mismatch returns null (caller rebuilds from filesystem) and
 * NEVER deletes a source file. Writes are atomic; the file is disposable.
 */
const CACHE_FILENAME = "metadata-v1.json";
const CACHE_SCHEMA_VERSION = 1;

const cacheFileSchema = z.object({
  schemaVersion: z.literal(CACHE_SCHEMA_VERSION),
  generatedAt: z.string(),
  notes: z.array(noteMetadataSchema),
});

export class MetadataCache {
  private readonly writer = new AtomicFileWriter();
  private readonly path: string;

  constructor(cacheDir: string) {
    this.path = join(cacheDir, CACHE_FILENAME);
  }

  async load(): Promise<NoteMetadata[] | null> {
    try {
      const parsed = cacheFileSchema.parse(JSON.parse(await readFile(this.path, "utf8")));
      return parsed.notes;
    } catch {
      return null;
    }
  }

  async save(notes: readonly NoteMetadata[]): Promise<void> {
    const payload = {
      schemaVersion: CACHE_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      notes,
    };
    await this.writer.write({
      absPath: this.path,
      relPath: `cache/${CACHE_FILENAME}`,
      bytes: Buffer.from(JSON.stringify(payload), "utf8"),
    });
  }
}
