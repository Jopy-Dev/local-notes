import { describe, expect, it } from "vitest";
import { SearchIndex } from "../../src/backend/search/search-index.js";
import type { NoteMetadata } from "../../src/shared/schemas/notes.js";

// Ranking tiers per REQ-009: exact title/filename > partial title/filename >
// exact content phrase > partial/fuzzy content. Tie-break: score desc ->
// modified desc -> relative path asc.
const meta = (relativePath: string, overrides: Partial<NoteMetadata> = {}): NoteMetadata => ({
  noteKey: Buffer.from(relativePath).toString("base64url"),
  relativePath,
  filename: relativePath.split("/").at(-1) ?? relativePath,
  title: (relativePath.split("/").at(-1) ?? relativePath).replace(/\.(md|txt)$/, ""),
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

function build(entries: Array<[NoteMetadata, string]>): SearchIndex {
  const index = new SearchIndex();
  for (const [note, content] of entries) index.upsert(note, content);
  return index;
}

describe("SearchIndex ranking tiers", () => {
  it("ranks exact title match above partial title above exact content above fuzzy content", () => {
    const index = build([
      [meta("fuzzy.md", { title: "unrelated" }), "the runway plans changed"],
      [meta("content.md", { title: "meeting" }), "our runway budget is fine"],
      [meta("partial.md", { title: "runway extension plan" }), "nothing else"],
      [meta("exact.md", { title: "runway" }), "empty body"],
    ]);
    const order = index.search("runway").map((entry) => entry.metadata.relativePath);
    expect(order.indexOf("exact.md")).toBeLessThan(order.indexOf("partial.md"));
    expect(order.indexOf("partial.md")).toBeLessThan(order.indexOf("content.md"));
  });

  it("title match ranks above content match across different notes (PRD acceptance)", () => {
    const index = build([
      [meta("body-hit.md", { title: "journal" }), "deploy checklist inside body"],
      [meta("title-hit.md", { title: "deploy checklist" }), "unrelated body"],
    ]);
    const order = index.search("deploy checklist").map((entry) => entry.metadata.relativePath);
    expect(order[0]).toBe("title-hit.md");
  });

  it("exact filename match counts as the exact tier", () => {
    const index = build([
      [meta("notes/roadmap.md", { title: "plans for later" }), "roadmap discussion"],
      [meta("other.md", { title: "roadmap draft thing" }), "no direct hit"],
    ]);
    const order = index.search("roadmap.md").map((entry) => entry.metadata.relativePath);
    expect(order[0]).toBe("notes/roadmap.md");
  });

  it("ties inside one tier break by modified desc then path asc", () => {
    const index = build([
      [meta("b-old.md", { title: "twin topic", modifiedAt: "2026-06-01T00:00:00.000Z" }), "same words"],
      [meta("a-new.md", { title: "twin topic", modifiedAt: "2026-07-01T00:00:00.000Z" }), "same words"],
      [meta("b-new.md", { title: "twin topic", modifiedAt: "2026-07-01T00:00:00.000Z" }), "same words"],
    ]);
    const order = index.search("twin topic").map((entry) => entry.metadata.relativePath);
    expect(order).toEqual(["a-new.md", "b-new.md", "b-old.md"]);
  });
});
