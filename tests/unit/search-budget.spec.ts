import { describe, expect, it } from "vitest";
import { SearchIndex } from "../../src/backend/search/search-index.js";
import type { NoteMetadata } from "../../src/shared/schemas/notes.js";

// Aggregate content budget per REQ-010: smallest-first on rebuild, overflow
// notes stay metadata-only searchable, freed budget rebalances smallest-first.
const meta = (relativePath: string, sizeBytes: number): NoteMetadata => ({
  noteKey: Buffer.from(relativePath).toString("base64url"),
  relativePath,
  filename: relativePath,
  title: relativePath.replace(".md", ""),
  extension: ".md",
  folder: "",
  createdAt: null,
  modifiedAt: "2026-07-01T00:00:00.000Z",
  sizeBytes,
  versionToken: "0".repeat(64),
  oversized: false,
  preview: "",
});

describe("SearchIndex content budget", () => {
  it("upsert beyond budget keeps note searchable as metadata-only", () => {
    const index = new SearchIndex({ contentBudgetBytes: 10 });
    index.upsert(meta("big-topic.md", 40), "x".repeat(40));
    const page = index.page("big-topic", 0);
    expect(page.results[0]?.contentIndexStatus).toBe("metadata-only");
    expect(index.status().metadataOnlyNotes).toBe(1);
  });

  it("changed note releases its previous allocation", () => {
    const index = new SearchIndex({ contentBudgetBytes: 10 });
    const note = meta("resize.md", 8);
    index.upsert(note, "y".repeat(8));
    expect(index.status().indexedNotes).toBe(1);
    // shrink: 8 -> 2 bytes frees budget for a second note
    index.upsert(note, "yy");
    index.upsert(meta("second.md", 6), "z".repeat(6));
    expect(index.status().indexedNotes).toBe(2);
    expect(index.status().metadataOnlyNotes).toBe(0);
  });

  it("rebuild allocates smallest-first and overflows the rest to metadata-only", () => {
    const index = new SearchIndex({ contentBudgetBytes: 10 });
    index.rebuild([
      { metadata: meta("large.md", 8), content: "l".repeat(8) },
      { metadata: meta("small.md", 4), content: "s".repeat(4) },
      { metadata: meta("mid.md", 5), content: "m".repeat(5) },
    ]);
    // smallest-first: small(4) + mid(5) = 9 fit; large(8) overflows
    const bySize = index.page("md", 0).results;
    const statuses = new Map(bySize.map((r) => [r.relativePath, r.contentIndexStatus]));
    expect(statuses.get("small.md")).toBe("full");
    expect(statuses.get("mid.md")).toBe("full");
    expect(statuses.get("large.md")).toBe("metadata-only");
  });

  it("remove frees budget and reports smallest-first rebalance candidates", () => {
    const index = new SearchIndex({ contentBudgetBytes: 10 });
    index.rebuild([
      { metadata: meta("keep.md", 5), content: "k".repeat(5) },
      { metadata: meta("waiting-small.md", 6), content: "w".repeat(6) },
      { metadata: meta("waiting-big.md", 7), content: "w".repeat(7) },
    ]);
    // smallest-first: keep(5) fits; waiting-small(6) and waiting-big(7) overflow
    expect(index.status().metadataOnlyNotes).toBe(2);
    index.remove(meta("keep.md", 5).noteKey);
    const candidates = index.rebalanceCandidates();
    expect(candidates[0]).toBe(meta("waiting-small.md", 6).noteKey);
    expect(candidates).toContain(meta("waiting-big.md", 7).noteKey);
  });
});
