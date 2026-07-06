import { EditorController } from "../../src/frontend/editor/editor-controller.js";
import type { NoteDocument, NoteMetadata } from "../../src/shared/schemas/notes.js";

/*
 * Shared EditorController test harness: fake transport with per-key disk
 * state, recorded loads/saves, and injectable save failures. Used by
 * editor-controller.spec.ts (open/autosave) and
 * editor-controller-conflicts.spec.ts (conflict/rename/delete flows).
 */
export const doc = (overrides: Partial<NoteDocument> = {}): NoteDocument => ({
  noteKey: "bm90ZS5tZA",
  relativePath: "note.md",
  filename: "note.md",
  title: "note",
  extension: ".md",
  folder: "",
  createdAt: null,
  modifiedAt: "2026-07-01T00:00:00.000Z",
  sizeBytes: 10,
  versionToken: "a".repeat(64),
  oversized: false,
  preview: "",
  content: "disk content",
  textEncoding: "utf8",
  lineEnding: "lf",
  ...overrides,
});

export interface Harness {
  controller: EditorController;
  loads: string[];
  saves: Array<{ draft: string; expectedVersion: string; operationId: string }>;
  failNextSaveWith: (code: string | null) => void;
  setDiskDocument: (document: NoteDocument) => void;
}

export function harness(initial: NoteDocument = doc()): Harness {
  // Disk keyed by noteKey so a flush for note A never mutates note B.
  const disks = new Map<string, NoteDocument>([[initial.noteKey, initial]]);
  let failCode: string | null = null;
  const loads: string[] = [];
  const saves: Harness["saves"] = [];
  let op = 0;
  const controller = new EditorController(
    {
      load: async (noteKey) => {
        loads.push(noteKey);
        const document = disks.get(noteKey);
        if (!document) throw Object.assign(new Error("missing"), { code: "NOTE_NOT_FOUND" });
        return document;
      },
      save: async (noteKey, draft, expectedVersion, operationId) => {
        if (failCode) {
          const error = Object.assign(new Error("save failed"), { code: failCode });
          failCode = null;
          throw error;
        }
        saves.push({ draft, expectedVersion, operationId });
        const current = disks.get(noteKey) ?? initial;
        const meta: NoteMetadata = { ...current, versionToken: `v${saves.length}`.padEnd(64, "0") };
        disks.set(noteKey, { ...current, ...meta, content: draft });
        return meta;
      },
    },
    { newOperationId: () => `op-${(op += 1)}` },
  );
  return {
    controller,
    loads,
    saves,
    failNextSaveWith: (code) => {
      failCode = code;
    },
    setDiskDocument: (document) => {
      disks.set(document.noteKey, document);
    },
  };
}
