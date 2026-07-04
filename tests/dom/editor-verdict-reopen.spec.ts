// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import type { NoteDocument } from "../../src/shared/schemas/notes.js";

/*
 * REQ-015 verdict staleness: closing a note resets the store to the
 * source-only closed state; reopening the SAME content must recompute the
 * visual verdict instead of trusting the content-identity memo - otherwise
 * a compatible note comes back "Visual editing is unavailable" until a hard
 * reload. Regression for the Wave 7 settings-route fallback.
 */
vi.mock("../../src/frontend/services/contentApi.js", () => ({
  loadNoteDocument: vi.fn(async (): Promise<NoteDocument> => doc()),
  saveNoteContent: vi.fn(async () => {
    throw new Error("no save expected");
  }),
}));

function doc(): NoteDocument {
  return {
    noteKey: "bm90ZS5tZA",
    relativePath: "note.md",
    filename: "note.md",
    title: "note",
    extension: ".md",
    folder: "",
    createdAt: null,
    modifiedAt: "2026-07-04T00:00:00.000Z",
    sizeBytes: 12,
    versionToken: "a".repeat(64),
    oversized: false,
    preview: "# T Body.",
    content: "# T\n\nBody.\n",
    markdownCompatibility: "edit",
    compatibilityReason: null,
    textEncoding: "utf8",
    lineEnding: "lf",
  };
}

describe("visual verdict across close/reopen (REQ-015)", () => {
  it("reopening the same content recomputes the verdict to edit", async () => {
    const { useEditorData } = await import("../../src/frontend/stores/editorData.js");
    await useEditorData.getState().openNote("bm90ZS5tZA");
    expect(useEditorData.getState().visualCompatibility).toBe("edit");

    await useEditorData.getState().closeNote();
    expect(useEditorData.getState().visualCompatibility).toBe("source-only");

    await useEditorData.getState().openNote("bm90ZS5tZA");
    expect(useEditorData.getState().visualCompatibility).toBe("edit");
  });
});
