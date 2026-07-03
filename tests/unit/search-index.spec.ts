import { describe, expect, it } from "vitest";
import { SearchIndex } from "../../src/backend/search/search-index.js";
import type { NoteMetadata } from "../../src/shared/schemas/notes.js";

// Search engine behaviour per MasterPrompt.md 4.3 (REQ-009/010).
const meta = (overrides: Partial<NoteMetadata>): NoteMetadata => ({
  noteKey: Buffer.from(overrides.relativePath ?? "a.md").toString("base64url"),
  relativePath: "a.md",
  filename: "a.md",
  title: "a",
  extension: ".md",
  folder: "",
  createdAt: null,
  modifiedAt: "2026-07-01T10:00:00.000Z",
  sizeBytes: 10,
  versionToken: "0".repeat(64),
  oversized: false,
  preview: "",
  ...overrides,
});

describe("SearchIndex discovery", () => {
  it("finds a note by typo-tolerant content match (REQ-009: strtup -> startup)", () => {
    const index = new SearchIndex();
    index.upsert(meta({ relativePath: "boot.md", filename: "boot.md", title: "boot notes" }),
      "Verify things at startup time.");
    const ranked = index.search("strtup");
    expect(ranked.map((entry) => entry.metadata.relativePath)).toContain("boot.md");
  });

  it("removed note disappears from results", () => {
    const index = new SearchIndex();
    const note = meta({ relativePath: "gone.md", filename: "gone.md", title: "ephemeral" });
    index.upsert(note, "ephemeral content");
    expect(index.search("ephemeral")).toHaveLength(1);
    index.remove(note.noteKey);
    expect(index.search("ephemeral")).toHaveLength(0);
  });

  it("upsert with changed content replaces the previous entry (REQ-010: one entry changes)", () => {
    const index = new SearchIndex();
    const note = meta({ relativePath: "v.md", filename: "v.md", title: "versioned" });
    index.upsert(note, "original wording");
    index.upsert(note, "revised wording");
    expect(index.search("original")).toHaveLength(0);
    expect(index.search("revised")).toHaveLength(1);
  });
});
