import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SearchIndexCache } from "../../src/backend/search/search-index-cache.js";
import type { NoteMetadata } from "../../src/shared/schemas/notes.js";

// search-index-v1.json is disposable (MasterPrompt.md 2.8): Zod + version
// validated on load, null on any mismatch, atomic writes, never a source file.
const meta = (relativePath: string): NoteMetadata => ({
  noteKey: Buffer.from(relativePath).toString("base64url"),
  relativePath,
  filename: relativePath,
  title: relativePath,
  extension: ".md",
  folder: "",
  createdAt: null,
  modifiedAt: "2026-07-01T00:00:00.000Z",
  sizeBytes: 5,
  versionToken: "0".repeat(64),
  oversized: false,
  preview: "",
});

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "ln-searchcache-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("SearchIndexCache", () => {
  it("round-trips indexed entries", async () => {
    const cache = new SearchIndexCache(dir);
    await cache.save([
      { metadata: meta("a.md"), content: "alpha body", contentIndexStatus: "full", truncated: false },
      { metadata: meta("b.md"), content: null, contentIndexStatus: "metadata-only", truncated: false },
    ]);
    const loaded = await cache.load();
    expect(loaded).toHaveLength(2);
    expect(loaded?.[0]?.content).toBe("alpha body");
    expect(loaded?.[1]?.content).toBeNull();
  });

  it("returns null on corrupt or missing file and never throws", async () => {
    const cache = new SearchIndexCache(dir);
    expect(await cache.load()).toBeNull();
    await writeFile(join(dir, "search-index-v1.json"), "{not json", "utf8");
    expect(await cache.load()).toBeNull();
  });

  it("returns null on schema version mismatch", async () => {
    const cache = new SearchIndexCache(dir);
    await cache.save([]);
    const raw = JSON.parse(await readFile(join(dir, "search-index-v1.json"), "utf8"));
    raw.schemaVersion = 999;
    await writeFile(join(dir, "search-index-v1.json"), JSON.stringify(raw), "utf8");
    expect(await cache.load()).toBeNull();
  });
});
