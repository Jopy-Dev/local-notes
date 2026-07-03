import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DraftUnsettledError, EditorController } from "../../src/frontend/editor/editor-controller.js";
import type { NoteDocument, NoteMetadata } from "../../src/shared/schemas/notes.js";

/*
 * Editor state machine (MasterPrompt.md 4.5, WF-006/007): 750ms autosave with
 * one in-flight save and queued latest draft, If-Match conflicts pause
 * autosave, SSE self-events are suppressed by operation ID, external changes
 * while dirty preserve BOTH versions until an explicit choice.
 */
const doc = (overrides: Partial<NoteDocument> = {}): NoteDocument => ({
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
  markdownCompatibility: "source-only",
  compatibilityReason: null,
  textEncoding: "utf8",
  lineEnding: "lf",
  ...overrides,
});

interface Harness {
  controller: EditorController;
  loads: string[];
  saves: Array<{ draft: string; expectedVersion: string; operationId: string }>;
  failNextSaveWith: (code: string | null) => void;
  setDiskDocument: (document: NoteDocument) => void;
}

function harness(initial: NoteDocument = doc()): Harness {
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

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("open (WF-005)", () => {
  it("loads the document into a saved editor", async () => {
    const { controller } = harness();
    await controller.open("bm90ZS5tZA");
    expect(controller.snapshot().draft).toBe("disk content");
    expect(controller.snapshot().saveState).toBe("saved");
    expect(controller.snapshot().readOnlyReason).toBeNull();
  });

  it("oversized and unsupported-encoding notes are read-only; edits are ignored", async () => {
    const { controller } = harness(doc({ oversized: true, content: "" }));
    await controller.open("bm90ZS5tZA");
    expect(controller.snapshot().readOnlyReason).toBe("oversized");
    controller.changeDraft("attempt");
    expect(controller.snapshot().draft).toBe("");
    expect(controller.snapshot().saveState).toBe("saved");

    const enc = harness(doc({ textEncoding: "unsupported", content: "" }));
    await enc.controller.open("bm90ZS5tZA");
    expect(enc.controller.snapshot().readOnlyReason).toBe("encoding");
  });
});

describe("autosave (WF-006, REQ-017)", () => {
  it("saves 750ms after the last edit with the loaded version", async () => {
    const { controller, saves } = harness();
    await controller.open("bm90ZS5tZA");
    controller.changeDraft("draft v1");
    expect(controller.snapshot().saveState).toBe("unsaved");
    await vi.advanceTimersByTimeAsync(700);
    controller.changeDraft("draft v2");
    await vi.advanceTimersByTimeAsync(740);
    expect(saves).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(10);
    await vi.runOnlyPendingTimersAsync();
    expect(saves).toHaveLength(1);
    expect(saves[0]?.draft).toBe("draft v2");
    expect(saves[0]?.expectedVersion).toBe("a".repeat(64));
    expect(controller.snapshot().saveState).toBe("saved");
  });

  it("edits during an in-flight save queue exactly one follow-up save", async () => {
    const saves: string[] = [];
    let releaseSave: (() => void) | undefined;
    const controller = new EditorController(
      {
        load: async () => doc(),
        save: async (_key, draft) => {
          saves.push(draft);
          // Hold the first save open so edits land while it is in flight.
          if (saves.length === 1) {
            await new Promise<void>((resolve) => {
              releaseSave = resolve;
            });
          }
          return { ...doc(), versionToken: `v${saves.length}`.padEnd(64, "0") };
        },
      },
      { newOperationId: () => `op-${saves.length + 1}` },
    );
    await controller.open("bm90ZS5tZA");
    controller.changeDraft("first");
    await vi.advanceTimersByTimeAsync(750);
    expect(saves).toEqual(["first"]);
    // In-flight now: these edits must coalesce into ONE follow-up save.
    controller.changeDraft("second");
    controller.changeDraft("third");
    await vi.advanceTimersByTimeAsync(750);
    releaseSave?.();
    await vi.runOnlyPendingTimersAsync();
    expect(saves).toEqual(["first", "third"]);
    expect(controller.snapshot().saveState).toBe("saved");
  });

  it("save failure keeps the draft, reports error, and retry saves again", async () => {
    const { controller, saves, failNextSaveWith } = harness();
    await controller.open("bm90ZS5tZA");
    failNextSaveWith("INTERNAL");
    controller.changeDraft("precious");
    await vi.advanceTimersByTimeAsync(750);
    await vi.runOnlyPendingTimersAsync();
    expect(controller.snapshot().saveState).toBe("error");
    expect(controller.snapshot().draft).toBe("precious");
    controller.retry();
    await vi.runOnlyPendingTimersAsync();
    expect(saves.map((entry) => entry.draft)).toEqual(["precious"]);
    expect(controller.snapshot().saveState).toBe("saved");
  });
});

describe("conflicts (WF-007, REQ-018)", () => {
  it("409 pauses autosave and opens the conflict surface", async () => {
    const { controller, saves, failNextSaveWith } = harness();
    await controller.open("bm90ZS5tZA");
    failNextSaveWith("NOTE_CONFLICT");
    controller.changeDraft("mine");
    await vi.advanceTimersByTimeAsync(750);
    await vi.runOnlyPendingTimersAsync();
    expect(controller.snapshot().saveState).toBe("conflict");
    expect(controller.snapshot().conflict).toBe("changed");
    controller.changeDraft("mine more");
    await vi.advanceTimersByTimeAsync(2000);
    expect(saves).toHaveLength(0);
  });

  it("suppresses SSE events carrying its own operation id", async () => {
    const { controller, loads, saves } = harness();
    await controller.open("bm90ZS5tZA");
    controller.changeDraft("draft");
    await vi.advanceTimersByTimeAsync(750);
    await vi.runOnlyPendingTimersAsync();
    expect(saves).toHaveLength(1);
    loads.length = 0;
    controller.handleWorkspaceEvent({
      type: "note.changed",
      noteKey: "bm90ZS5tZA",
      version: "x".repeat(64),
      operationId: "op-1",
    });
    await vi.runOnlyPendingTimersAsync();
    expect(loads).toHaveLength(0);
    expect(controller.snapshot().conflict).toBeNull();
  });

  it("foreign change while clean refetches; while dirty raises conflict preserving the draft", async () => {
    const clean = harness();
    await clean.controller.open("bm90ZS5tZA");
    clean.setDiskDocument(doc({ content: "external", versionToken: "b".repeat(64) }));
    clean.controller.handleWorkspaceEvent({
      type: "note.changed",
      noteKey: "bm90ZS5tZA",
      version: "b".repeat(64),
    });
    await vi.runOnlyPendingTimersAsync();
    expect(clean.controller.snapshot().draft).toBe("external");

    const dirty = harness();
    await dirty.controller.open("bm90ZS5tZA");
    dirty.controller.changeDraft("unsaved local");
    dirty.controller.handleWorkspaceEvent({
      type: "note.changed",
      noteKey: "bm90ZS5tZA",
      version: "b".repeat(64),
    });
    expect(dirty.controller.snapshot().conflict).toBe("changed");
    expect(dirty.controller.snapshot().draft).toBe("unsaved local");
  });

  it("external delete while dirty marks source-missing", async () => {
    const { controller } = harness();
    await controller.open("bm90ZS5tZA");
    controller.changeDraft("unsaved");
    controller.handleWorkspaceEvent({ type: "note.removed", noteKey: "bm90ZS5tZA" });
    expect(controller.snapshot().conflict).toBe("source-missing");
    expect(controller.snapshot().draft).toBe("unsaved");
  });

  it("flushes a pending draft before opening another note (REQ-017)", async () => {
    const { controller, saves, setDiskDocument } = harness();
    await controller.open("bm90ZS5tZA");
    controller.changeDraft("pending draft");
    // Switch before the 750ms autosave fires: the draft must not be lost.
    setDiskDocument(doc({ noteKey: "b3RoZXIubWQ", relativePath: "other.md", content: "other" }));
    await controller.open("b3RoZXIubWQ");
    expect(saves.map((entry) => entry.draft)).toEqual(["pending draft"]);
    expect(controller.snapshot().draft).toBe("other");
    expect(controller.snapshot().saveState).toBe("saved");
  });

  it("an in-flight save settles before another note opens (no cross-note bleed)", async () => {
    const docA = doc();
    const docB = doc({
      noteKey: "b3RoZXIubWQ",
      relativePath: "other.md",
      filename: "other.md",
      content: "other",
      versionToken: "b".repeat(64),
    });
    let releaseSave: (() => void) | undefined;
    const controller = new EditorController({
      load: async (key) => (key === docA.noteKey ? docA : docB),
      save: async () => {
        await new Promise<void>((resolve) => {
          releaseSave = resolve;
        });
        return { ...docA, versionToken: "c".repeat(64) };
      },
    });
    await controller.open(docA.noteKey);
    controller.changeDraft("dirty");
    await vi.advanceTimersByTimeAsync(750);
    expect(releaseSave).toBeDefined();
    let opened = false;
    const opening = controller.open(docB.noteKey).then(() => {
      opened = true;
    });
    await vi.advanceTimersByTimeAsync(0);
    // The switch must wait for the in-flight save, not race it.
    expect(opened).toBe(false);
    releaseSave?.();
    await opening;
    expect(controller.snapshot().noteKey).toBe(docB.noteKey);
    expect(controller.snapshot().draft).toBe("other");
    expect(controller.snapshot().document?.versionToken).toBe("b".repeat(64));
    expect(controller.snapshot().saveState).toBe("saved");
  });

  it("a draft that cannot save blocks the switch until discarded (REQ-017 stay/discard)", async () => {
    const { controller, failNextSaveWith, setDiskDocument } = harness();
    setDiskDocument(
      doc({ noteKey: "b3RoZXIubWQ", relativePath: "other.md", content: "other", versionToken: "b".repeat(64) }),
    );
    await controller.open("bm90ZS5tZA");
    failNextSaveWith("INTERNAL");
    controller.changeDraft("precious");
    // Flush fails -> the switch must not proceed and the draft must survive.
    await expect(controller.open("b3RoZXIubWQ")).rejects.toBeInstanceOf(DraftUnsettledError);
    expect(controller.snapshot().noteKey).toBe("bm90ZS5tZA");
    expect(controller.snapshot().draft).toBe("precious");
    expect(controller.snapshot().saveState).toBe("error");
    // Explicit discard releases the guard.
    controller.discardDraft();
    await controller.open("b3RoZXIubWQ");
    expect(controller.snapshot().noteKey).toBe("b3RoZXIubWQ");
    expect(controller.snapshot().draft).toBe("other");
  });

  it("an unresolved conflict blocks the switch until discarded", async () => {
    const { controller, setDiskDocument } = harness();
    setDiskDocument(
      doc({ noteKey: "b3RoZXIubWQ", relativePath: "other.md", content: "other", versionToken: "b".repeat(64) }),
    );
    await controller.open("bm90ZS5tZA");
    controller.changeDraft("mine");
    controller.handleWorkspaceEvent({ type: "note.changed", noteKey: "bm90ZS5tZA", version: "b".repeat(64) });
    expect(controller.snapshot().conflict).toBe("changed");
    await expect(controller.open("b3RoZXIubWQ")).rejects.toBeInstanceOf(DraftUnsettledError);
    expect(controller.snapshot().draft).toBe("mine");
    controller.discardDraft();
    await controller.open("b3RoZXIubWQ");
    expect(controller.snapshot().noteKey).toBe("b3RoZXIubWQ");
    expect(controller.snapshot().conflict).toBeNull();
  });

  it("a stale in-flight save settling after reload never resurrects the conflict", async () => {
    const base = doc();
    let disk = base;
    let rejectSave: ((error: Error) => void) | undefined;
    const controller = new EditorController({
      load: async () => disk,
      save: async () =>
        new Promise((_resolve, reject) => {
          rejectSave = reject;
        }),
    });
    await controller.open(base.noteKey);
    controller.changeDraft("mine");
    await vi.advanceTimersByTimeAsync(750);
    expect(rejectSave).toBeDefined();
    // External change lands while the save hangs; user resolves via reload.
    disk = doc({ content: "theirs", versionToken: "b".repeat(64) });
    await controller.resolveReload();
    expect(controller.snapshot().draft).toBe("theirs");
    expect(controller.snapshot().saveState).toBe("saved");
    // The parked save now settles 409 — it belongs to the discarded draft.
    rejectSave?.(Object.assign(new Error("conflict"), { code: "NOTE_CONFLICT" }));
    await vi.runOnlyPendingTimersAsync();
    expect(controller.snapshot().saveState).toBe("saved");
    expect(controller.snapshot().conflict).toBeNull();
    expect(controller.snapshot().draft).toBe("theirs");
  });

  it("reload adopts the disk version; overwrite saves the draft over it", async () => {
    const reloadCase = harness();
    await reloadCase.controller.open("bm90ZS5tZA");
    reloadCase.controller.changeDraft("mine");
    reloadCase.setDiskDocument(doc({ content: "theirs", versionToken: "b".repeat(64) }));
    reloadCase.controller.handleWorkspaceEvent({
      type: "note.changed",
      noteKey: "bm90ZS5tZA",
      version: "b".repeat(64),
    });
    await reloadCase.controller.resolveReload();
    expect(reloadCase.controller.snapshot().draft).toBe("theirs");
    expect(reloadCase.controller.snapshot().saveState).toBe("saved");
    expect(reloadCase.controller.snapshot().conflict).toBeNull();

    const overwriteCase = harness();
    await overwriteCase.controller.open("bm90ZS5tZA");
    overwriteCase.controller.changeDraft("mine");
    overwriteCase.setDiskDocument(doc({ content: "theirs", versionToken: "b".repeat(64) }));
    overwriteCase.controller.handleWorkspaceEvent({
      type: "note.changed",
      noteKey: "bm90ZS5tZA",
      version: "b".repeat(64),
    });
    await overwriteCase.controller.resolveOverwrite();
    expect(overwriteCase.saves.at(-1)?.draft).toBe("mine");
    expect(overwriteCase.saves.at(-1)?.expectedVersion).toBe("b".repeat(64));
    expect(overwriteCase.controller.snapshot().saveState).toBe("saved");
    expect(overwriteCase.controller.snapshot().conflict).toBeNull();
  });
});
