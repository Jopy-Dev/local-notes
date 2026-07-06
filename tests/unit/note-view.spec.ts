import { describe, expect, it } from "vitest";
import { folderCounts, formatNoteTime, toListEntry } from "../../src/frontend/services/noteView.js";
import type { NoteMetadata } from "../../src/shared/schemas/notes.js";

// Presentation mappers for dashboard data (REQ-007 list/card fields).
const meta = (overrides: Partial<NoteMetadata>): NoteMetadata => ({
  noteKey: "a2V5",
  relativePath: "projects/a.md",
  filename: "a.md",
  title: "a",
  extension: ".md",
  folder: "projects",
  createdAt: null,
  modifiedAt: "2026-07-01T10:00:00.000Z",
  sizeBytes: 10,
  versionToken: "0".repeat(64),
  oversized: false,
  preview: "preview text",
  ...overrides,
});

describe("formatNoteTime", () => {
  const now = new Date("2026-07-03T12:00:00Z");

  it("shows clock time for today, Yesterday for yesterday, short date otherwise", () => {
    expect(formatNoteTime(now.toISOString(), now)).toMatch(/\d{1,2}:\d{2}/);
    expect(formatNoteTime(new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(), now)).toBe(
      "Yesterday",
    );
    expect(formatNoteTime("2026-06-11T09:00:00Z", now)).toMatch(/Jun/);
  });
});

describe("toListEntry", () => {
  it("maps metadata to the list-item shape", () => {
    const entry = toListEntry(meta({}), new Date("2026-07-03T12:00:00Z"));
    expect(entry.key).toBe("a2V5");
    expect(entry.title).toBe("a");
    expect(entry.fileType).toBe("MD");
    expect(entry.path).toBe("projects");
    expect(entry.preview).toBe("preview text");
  });

  it("uses TXT for .txt and root folder shows empty path", () => {
    const entry = toListEntry(
      meta({ extension: ".txt", folder: "", relativePath: "b.txt", filename: "b.txt" }),
      new Date(),
    );
    expect(entry.fileType).toBe("TXT");
    expect(entry.path).toBe("");
  });
});

describe("folderCounts", () => {
  it("counts notes per folder including nested rollup to the direct folder", () => {
    const notes = [
      meta({ folder: "projects" }),
      meta({ folder: "projects" }),
      meta({ folder: "projects/alpha" }),
      meta({ folder: "" }),
    ];
    const counts = folderCounts(notes);
    expect(counts.get("projects")).toBe(2);
    expect(counts.get("projects/alpha")).toBe(1);
  });
});
