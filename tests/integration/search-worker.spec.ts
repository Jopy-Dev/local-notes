import { execSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { SearchIndexCache } from "../../src/backend/search/search-index-cache.js";
import {
  WorkerSearchEngine,
  resolveSearchWorkerPath,
  spawnSearchWorker,
} from "../../src/backend/search/worker-engine.js";
import type { WorkerLike } from "../../src/backend/search/worker-engine.js";
import type { NoteMetadata } from "../../src/shared/schemas/notes.js";

/*
 * Real worker-thread coverage per MasterPrompt.md 8.2: init, upsert, remove,
 * search, rebuild, save/load, status, shutdown, crash + restart. The worker
 * runs only as compiled JS (Node cannot resolve .js specifiers from .ts
 * sources), so the dist build is produced once up front.
 */
const BUILD_TIMEOUT_MS = 180_000;

let workerPath: string;

beforeAll(() => {
  execSync("npm run build:server", { cwd: process.cwd(), stdio: "ignore" });
  const resolved = resolveSearchWorkerPath();
  if (!resolved) throw new Error("dist search worker missing after build:server");
  workerPath = resolved;
}, BUILD_TIMEOUT_MS);

const meta = (relativePath: string, sizeBytes = 10): NoteMetadata => ({
  noteKey: Buffer.from(relativePath).toString("base64url"),
  relativePath,
  filename: relativePath,
  title: relativePath.replace(".md", ""),
  extension: ".md",
  folder: "",
  createdAt: null,
  modifiedAt: "2026-07-01T00:00:00.000Z",
  sizeBytes,
  versionToken: "0".repeat(64),
  oversized: false,
  preview: "",
});

const entry = (relativePath: string, content: string) => ({
  metadata: meta(relativePath, content.length),
  content,
  truncated: false,
});

const engines: WorkerSearchEngine[] = [];

function startEngine(onSpawn?: (worker: WorkerLike) => void): WorkerSearchEngine {
  const engine = new WorkerSearchEngine(() => {
    const worker = spawnSearchWorker(workerPath);
    onSpawn?.(worker);
    return worker;
  });
  engines.push(engine);
  return engine;
}

afterEach(async () => {
  await Promise.all(engines.splice(0).map((engine) => engine.close().catch(() => undefined)));
});

describe("search worker thread", () => {
  it("INIT + SEARCH + STATUS serve ranked results from the thread", async () => {
    const engine = startEngine();
    const counts = await engine.init([
      entry("alpha.md", "an alpha token inside"),
      entry("beta.md", "unrelated words"),
    ]);
    expect(counts).toEqual({ indexedNotes: 2, metadataOnlyNotes: 0 });
    const page = await engine.page("alpha", 0);
    expect(page.total).toBe(1);
    expect(page.results[0]?.relativePath).toBe("alpha.md");
    expect(await engine.status()).toEqual({ indexedNotes: 2, metadataOnlyNotes: 0 });
  });

  it("UPSERT and REMOVE mutate one document at a time", async () => {
    const engine = startEngine();
    await engine.init([]);
    const upserted = await engine.upsert(meta("note.md"), "findable content", false);
    expect(upserted.counts.indexedNotes).toBe(1);
    expect((await engine.page("findable", 0)).total).toBe(1);

    const removed = await engine.remove(meta("note.md").noteKey);
    expect(removed.counts.indexedNotes).toBe(0);
    expect((await engine.page("findable", 0)).total).toBe(0);
  });

  it("REBUILD replaces the whole index", async () => {
    const engine = startEngine();
    await engine.init([entry("old.md", "old words")]);
    await engine.rebuild([entry("new.md", "new words")]);
    expect((await engine.page("old", 0)).total).toBe(0);
    expect((await engine.page("new", 0)).total).toBe(1);
  });

  it("SAVE snapshot round-trips through the disk cache into a fresh worker", async () => {
    const cacheDir = await mkdtemp(join(tmpdir(), "ln-worker-cache-"));
    try {
      const first = startEngine();
      await first.init([entry("persisted.md", "durable searchable words")]);
      const cache = new SearchIndexCache(cacheDir);
      await cache.save(await first.snapshot());

      const loaded = await cache.load();
      expect(loaded).not.toBeNull();
      const second = startEngine();
      await second.init(
        (loaded ?? []).map((cached) => ({
          metadata: cached.metadata,
          content: cached.content,
          truncated: cached.truncated,
        })),
      );
      expect((await second.page("durable", 0)).total).toBe(1);
    } finally {
      await rm(cacheDir, { recursive: true, force: true });
    }
  });

  it("a malformed message returns a typed error, not a dead thread", async () => {
    const engine = startEngine();
    await engine.init([]);
    // Metadata missing entirely: the worker's handler throws and must answer
    // with ok:false instead of crashing the thread.
    const rejected = engine.upsert(undefined as unknown as NoteMetadata, "x", false);
    await expect(rejected).rejects.toThrow();
    expect((await engine.status()).indexedNotes).toBe(0);
  });

  it("crash rejects in-flight work, fires onCrash, and a respawn + rebuild recovers", async () => {
    const spawned: WorkerLike[] = [];
    const engine = startEngine((worker) => spawned.push(worker));
    await engine.init([entry("live.md", "living words")]);

    let crashed = false;
    engine.onCrash(() => {
      crashed = true;
    });
    // Kill the thread out from under the host - simulates a worker crash.
    await spawned[0]!.terminate();
    await vi.waitFor(() => expect(crashed).toBe(true));
    await expect(engine.page("living", 0)).rejects.toThrow("Search worker is not running.");

    await engine.ensureRunning();
    await engine.rebuild([entry("live.md", "living words")]);
    expect((await engine.page("living", 0)).total).toBe(1);
    expect(spawned).toHaveLength(2);
  });

  it("close shuts the worker down gracefully and further requests reject", async () => {
    const engine = startEngine();
    await engine.init([]);
    await engine.close();
    await expect(engine.status()).rejects.toThrow("Search worker is not running.");
  });
});
