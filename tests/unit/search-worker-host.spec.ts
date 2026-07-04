import { describe, expect, it } from "vitest";
import { WorkerSearchEngine } from "../../src/backend/search/worker-engine.js";
import type { WorkerLike } from "../../src/backend/search/worker-engine.js";
import type { WorkerRequest, WorkerResponse } from "../../src/backend/search/worker-protocol.js";

/*
 * Host-side protocol behavior per MasterPrompt.md 4.3: requestId correlation
 * (including out-of-order responses), typed error propagation, crash
 * detection with in-flight rejection, and respawn via ensureRunning. The real
 * thread is covered by tests/integration/search-worker.spec.ts.
 */
class FakeWorker implements WorkerLike {
  readonly sent: WorkerRequest[] = [];
  private readonly listeners: Record<"message" | "error" | "exit", Array<(value: unknown) => void>> = {
    message: [],
    error: [],
    exit: [],
  };

  postMessage(value: unknown): void {
    this.sent.push(value as WorkerRequest);
  }

  on(event: "message", listener: (value: unknown) => void): void;
  on(event: "error", listener: (error: Error) => void): void;
  on(event: "exit", listener: (code: number) => void): void;
  on(event: "message" | "error" | "exit", listener: unknown): void {
    this.listeners[event].push(listener as (value: unknown) => void);
  }

  async terminate(): Promise<number> {
    this.emitExit(1);
    return 1;
  }

  unref(): void {}

  reply(response: WorkerResponse): void {
    for (const listener of this.listeners.message) listener(response);
  }

  emitExit(code: number): void {
    for (const listener of this.listeners.exit) listener(code);
  }
}

const counts = { indexedNotes: 0, metadataOnlyNotes: 0 };

function harness(): { engine: WorkerSearchEngine; workers: FakeWorker[] } {
  const workers: FakeWorker[] = [];
  const engine = new WorkerSearchEngine(() => {
    const worker = new FakeWorker();
    workers.push(worker);
    return worker;
  });
  return { engine, workers };
}

describe("WorkerSearchEngine protocol", () => {
  it("correlates out-of-order responses by requestId", async () => {
    const { engine, workers } = harness();
    const worker = workers[0]!;
    const first = engine.status();
    const second = engine.page("query", 0);
    const [statusRequest, searchRequest] = worker.sent;
    expect(statusRequest).toMatchObject({ type: "STATUS", requestId: 1 });
    expect(searchRequest).toMatchObject({ type: "SEARCH", requestId: 2 });

    const page = { results: [], total: 3, hasMore: false };
    worker.reply({ type: "SEARCH", requestId: 2, ok: true, page });
    worker.reply({ type: "STATUS", requestId: 1, ok: true, counts });
    expect(await second).toEqual(page);
    expect(await first).toEqual(counts);
  });

  it("propagates a typed worker error as a rejection", async () => {
    const { engine, workers } = harness();
    const pending = engine.remove("missing");
    workers[0]!.reply({ type: "REMOVE", requestId: 1, ok: false, error: "boom from worker" });
    await expect(pending).rejects.toThrow("boom from worker");
  });

  it("unexpected exit rejects in-flight requests and fires onCrash once", async () => {
    const { engine, workers } = harness();
    let crashes = 0;
    engine.onCrash(() => {
      crashes += 1;
    });
    const pending = engine.status();
    workers[0]!.emitExit(1);
    await expect(pending).rejects.toThrow("Search worker stopped.");
    expect(crashes).toBe(1);
    await expect(engine.status()).rejects.toThrow("Search worker is not running.");
  });

  it("ensureRunning respawns a dead worker", async () => {
    const { engine, workers } = harness();
    workers[0]!.emitExit(1);
    await engine.ensureRunning();
    expect(workers).toHaveLength(2);
    const pending = engine.status();
    workers[1]!.reply({ type: "STATUS", requestId: 1, ok: true, counts });
    expect(await pending).toEqual(counts);
  });

  it("close sends SHUTDOWN and never reports the exit as a crash", async () => {
    const { engine, workers } = harness();
    const worker = workers[0]!;
    let crashes = 0;
    engine.onCrash(() => {
      crashes += 1;
    });
    const closing = engine.close();
    expect(worker.sent.at(-1)).toMatchObject({ type: "SHUTDOWN" });
    worker.reply({ type: "SHUTDOWN", requestId: 1, ok: true });
    await closing;
    expect(crashes).toBe(0);
    await engine.ensureRunning();
    expect(workers).toHaveLength(1);
  });
});
