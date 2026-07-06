import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DraftUnsettledError, EditorController } from "../../src/frontend/editor/editor-controller.js";
import { doc, harness } from "./editor-controller-harness.js";

/*
 * Editor conflict, rename, and delete flows (MasterPrompt.md 4.5, WF-007,
 * REQ-017/018): If-Match conflicts pause autosave, SSE self-events are
 * suppressed by operation ID, external changes while dirty preserve BOTH
 * versions until an explicit choice, external renames follow the new key
 * when clean. Open/autosave behavior lives in editor-controller.spec.ts.
 */
beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
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

  it("external delete while clean parks as source-missing (proactive notice)", async () => {
    const { controller } = harness();
    await controller.open("bm90ZS5tZA");
    controller.handleWorkspaceEvent({ type: "note.removed", noteKey: "bm90ZS5tZA" });
    expect(controller.snapshot().conflict).toBe("source-missing");
    // The last-loaded content stays recoverable via save-as-new.
    expect(controller.snapshot().draft).toBe("disk content");
  });

  it("app-originated delete (operation-tagged) while clean is ignored - archive flow navigates", async () => {
    const { controller } = harness();
    await controller.open("bm90ZS5tZA");
    controller.handleWorkspaceEvent({
      type: "note.removed",
      noteKey: "bm90ZS5tZA",
      operationId: "op-archive",
    });
    expect(controller.snapshot().conflict).toBeNull();
    expect(controller.snapshot().saveState).toBe("saved");
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

describe("external rename (REQ-018)", () => {
  const renamedEvent = (operationId?: string) => ({
    type: "note.renamed",
    oldKey: "bm90ZS5tZA",
    noteKey: "cmVuYW1lZC5tZA",
    version: "b".repeat(64),
    ...(operationId ? { operationId } : {}),
  });

  it("a clean open note follows the new key automatically", async () => {
    const { controller, setDiskDocument, loads } = harness();
    setDiskDocument(
      doc({
        noteKey: "cmVuYW1lZC5tZA",
        relativePath: "renamed.md",
        filename: "renamed.md",
        versionToken: "b".repeat(64),
      }),
    );
    await controller.open("bm90ZS5tZA");
    controller.handleWorkspaceEvent(renamedEvent());
    await vi.runOnlyPendingTimersAsync();
    expect(loads).toEqual(["bm90ZS5tZA", "cmVuYW1lZC5tZA"]);
    expect(controller.snapshot().noteKey).toBe("cmVuYW1lZC5tZA");
    expect(controller.snapshot().draft).toBe("disk content");
    expect(controller.snapshot().saveState).toBe("saved");
  });

  it("a dirty draft parks as source-missing instead of following", async () => {
    const { controller } = harness();
    await controller.open("bm90ZS5tZA");
    controller.changeDraft("unsaved local");
    controller.handleWorkspaceEvent(renamedEvent());
    expect(controller.snapshot().noteKey).toBe("bm90ZS5tZA");
    expect(controller.snapshot().conflict).toBe("source-missing");
    expect(controller.snapshot().draft).toBe("unsaved local");
  });

  it("an app move (operation-tagged) is ignored - the move flow navigates", async () => {
    const { controller, loads } = harness();
    await controller.open("bm90ZS5tZA");
    loads.length = 0;
    controller.handleWorkspaceEvent(renamedEvent("op-move-1"));
    await vi.runOnlyPendingTimersAsync();
    expect(loads).toHaveLength(0);
    expect(controller.snapshot().noteKey).toBe("bm90ZS5tZA");
  });

  it("a rename of a different note is ignored", async () => {
    const { controller, loads } = harness();
    await controller.open("bm90ZS5tZA");
    loads.length = 0;
    controller.handleWorkspaceEvent({
      type: "note.renamed",
      oldKey: "b3RoZXIubWQ",
      noteKey: "bmV3Lm1k",
      version: "b".repeat(64),
    });
    expect(loads).toHaveLength(0);
    expect(controller.snapshot().noteKey).toBe("bm90ZS5tZA");
  });
});
