import { describe, expect, it } from "vitest";
import { SearchIndex } from "../../src/backend/search/search-index.js";
import { SEARCH_BATCH_SIZE } from "../../src/shared/schemas/search.js";
import type { NoteMetadata } from "../../src/shared/schemas/notes.js";

// Batches of exactly 200 with stable order across pages (REQ-009).
const meta = (relativePath: string, modifiedAt: string): NoteMetadata => ({
  noteKey: Buffer.from(relativePath).toString("base64url"),
  relativePath,
  filename: relativePath,
  title: relativePath.replace(".md", ""),
  extension: ".md",
  folder: "",
  createdAt: null,
  modifiedAt,
  sizeBytes: 10,
  versionToken: "0".repeat(64),
  oversized: false,
  preview: "",
});

describe("SearchIndex.page", () => {
  it("returns batches of 200 with total and hasMore, no overlap across pages", () => {
    const index = new SearchIndex();
    for (let i = 0; i < 250; i += 1) {
      const stamp = `2026-06-${String((i % 28) + 1).padStart(2, "0")}T00:00:0${i % 10}.000Z`;
      index.upsert(meta(`note-${String(i).padStart(3, "0")}.md`, stamp), "shared corpus token");
    }
    const first = index.page("corpus", 0);
    expect(first.results).toHaveLength(SEARCH_BATCH_SIZE);
    expect(first.total).toBe(250);
    expect(first.hasMore).toBe(true);

    const second = index.page("corpus", SEARCH_BATCH_SIZE);
    expect(second.results).toHaveLength(50);
    expect(second.hasMore).toBe(false);
    const keys = new Set([...first.results, ...second.results].map((r) => r.noteKey));
    expect(keys.size).toBe(250);
  });

  it("result DTO carries snippet, ranges, and metadata-only status", () => {
    const index = new SearchIndex();
    const note = meta("only.md", "2026-07-01T00:00:00.000Z");
    index.upsert({ ...note, title: "needle title" }, null);
    const page = index.page("needle", 0);
    expect(page.results[0]?.contentIndexStatus).toBe("metadata-only");
    expect(page.results[0]?.snippet).toBe("");
    expect(page.results[0]?.matchRanges).toEqual([]);
  });
});
