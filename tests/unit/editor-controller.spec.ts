import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorController } from "../../src/frontend/editor/editor-controller.js";
import { doc, harness } from "./editor-controller-harness.js";

/*
 * Editor state machine open + autosave behavior (MasterPrompt.md 4.5,
 * WF-005/006): 750ms autosave with one in-flight save and queued latest
 * draft. Conflict, rename, and delete flows live in
 * editor-controller-conflicts.spec.ts; shared fakes in
 * editor-controller-harness.ts.
 */
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
