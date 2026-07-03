import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OperationRegistry } from "../../src/backend/events/operation-registry.js";

/*
 * Self-event suppression (MasterPrompt.md 4.5): mutations register their
 * operation ID per touched path; the watcher attaches it to the resulting
 * SSE event so clients skip false conflicts. Entries are single-shot and
 * expire so unrelated later events never inherit a stale ID.
 */
describe("OperationRegistry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the registered operation once, then undefined", () => {
    const registry = new OperationRegistry();
    registry.register("projects/a.md", "op-1");
    expect(registry.take("projects/a.md")).toBe("op-1");
    expect(registry.take("projects/a.md")).toBeUndefined();
  });

  it("expires entries after the TTL", () => {
    const registry = new OperationRegistry({ ttlMs: 1000 });
    registry.register("a.md", "op-2");
    vi.advanceTimersByTime(1500);
    expect(registry.take("a.md")).toBeUndefined();
  });

  it("tracks multiple paths under one operation (move: unlink + add)", () => {
    const registry = new OperationRegistry();
    registry.register("old.md", "op-3");
    registry.register("projects/new.md", "op-3");
    expect(registry.take("old.md")).toBe("op-3");
    expect(registry.take("projects/new.md")).toBe("op-3");
  });
});
