import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WorkspaceWatcher } from "../../src/backend/watcher/workspace-watcher.js";
import type { WatchEvent } from "../../src/backend/watcher/workspace-watcher.js";

/*
 * Watcher pipeline (MasterPrompt.md 4.2, REQ-006): external create/change/
 * delete surfaces as coalesced batches within the 2s product budget; temp
 * artifacts ignored; symlinks not followed.
 */
let dir: string;
let watcher: WorkspaceWatcher;
let batches: WatchEvent[][];

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "ln-watch-"));
  mkdirSync(join(dir, "sub"), { recursive: true });
  batches = [];
  watcher = new WorkspaceWatcher(dir, {
    onBatch: (events) => batches.push(events),
  });
  await watcher.ready();
});

afterEach(async () => {
  await watcher.close();
  rmSync(dir, { recursive: true, force: true });
});

async function waitFor(predicate: () => boolean, timeoutMs = 4000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error("timed out waiting for watch events");
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

function allEvents(): WatchEvent[] {
  return batches.flat();
}

describe("WorkspaceWatcher", () => {
  it("reports external create and change with POSIX relative paths", async () => {
    writeFileSync(join(dir, "sub", "new.md"), "hello");
    await waitFor(() => allEvents().some((event) => event.relPath === "sub/new.md"));
    expect(
      allEvents().some((event) => event.kind === "added" && event.relPath === "sub/new.md"),
    ).toBe(true);

    writeFileSync(join(dir, "sub", "new.md"), "hello changed");
    await waitFor(() =>
      allEvents().some((event) => event.kind === "changed" && event.relPath === "sub/new.md"),
    );
  });

  it("reports external delete", async () => {
    writeFileSync(join(dir, "gone.md"), "x");
    await waitFor(() => allEvents().some((event) => event.relPath === "gone.md"));
    rmSync(join(dir, "gone.md"));
    await waitFor(() =>
      allEvents().some((event) => event.kind === "removed" && event.relPath === "gone.md"),
    );
  });

  it("ignores Local-Notes temp artifacts", async () => {
    writeFileSync(join(dir, ".local-notes-tmp-abc"), "temp");
    writeFileSync(join(dir, "real.md"), "real");
    await waitFor(() => allEvents().some((event) => event.relPath === "real.md"));
    expect(allEvents().some((event) => event.relPath.includes(".local-notes-tmp-"))).toBe(false);
  });

  it("coalesces bursts into batched emissions", async () => {
    for (let index = 0; index < 5; index += 1) {
      writeFileSync(join(dir, `burst-${index}.md`), String(index));
    }
    await waitFor(
      () => allEvents().filter((event) => event.relPath.startsWith("burst-")).length === 5,
    );
    // 5 files must not arrive as 5 separate single-event batches.
    const burstBatches = batches.filter((batch) =>
      batch.some((event) => event.relPath.startsWith("burst-")),
    );
    expect(burstBatches.length).toBeLessThan(5);
  });
});
