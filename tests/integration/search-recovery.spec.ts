import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/backend/app.js";
import { NoteRepository } from "../../src/backend/filesystem/note-repository.js";
import { WorkspacePathGuard } from "../../src/backend/filesystem/path-guard.js";
import { readIndexableContent } from "../../src/backend/search/search-content.js";
import { SearchService } from "../../src/backend/search/search-service.js";
import { WorkerSearchEngine, spawnSearchWorker } from "../../src/backend/search/worker-engine.js";
import type { WorkerLike } from "../../src/backend/search/worker-engine.js";
import { generateCapability } from "../../src/backend/security/index.js";
import { LOCAL_HOST_HEADER } from "../../src/shared/constants/server.js";
import { ensureDistBuilt } from "./dist-build.js";

/*
 * Search recovery end-to-end (WF-011, MasterPrompt.md 4.3 + 8.4 "search
 * degradation/rebuild") with the real worker thread and real routes: the
 * first crash consumes the automatic restart; a second crash stays degraded
 * (503 SEARCH_DEGRADED), and the recovery-screen rebuild route respawns the
 * worker and restores ranked search.
 */
const BUILD_TIMEOUT_MS = 180_000;

let workerPath: string;

beforeAll(() => {
  workerPath = ensureDistBuilt();
}, BUILD_TIMEOUT_MS);

let root: string;
let capability: string;
let app: FastifyInstance;
let service: SearchService;
const spawned: WorkerLike[] = [];

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), "ln-recovery-"));
  const notesDir = join(root, "save-data", "notes");
  mkdirSync(notesDir, { recursive: true });
  writeFileSync(join(notesDir, "runway.md"), "# Runway\nBudget analysis for the runway.");
  capability = generateCapability();

  const guard = await WorkspacePathGuard.create(root);
  const repository = new NoteRepository(guard, "save-data/notes");
  spawned.length = 0;
  const engine = new WorkerSearchEngine(() => {
    const worker = spawnSearchWorker(workerPath);
    spawned.push(worker);
    return worker;
  });
  service = new SearchService({
    engine,
    notesFor: () => repository.scan(),
    contentFor: async (note) => {
      try {
        return await readIndexableContent(await guard.resolve(`save-data/notes/${note.relativePath}`));
      } catch {
        return { content: null, truncated: false };
      }
    },
  });
  await service.initialize(await repository.scan());
  app = await buildApp({
    capability,
    workspaceRoot: root,
    noteRepository: repository,
    searchService: service,
  });
});

afterEach(async () => {
  await app.close();
  await service.close();
  rmSync(root, { recursive: true, force: true });
});

const headers = () => ({ host: LOCAL_HOST_HEADER, "x-local-notes-token": capability });

describe("search recovery flow (WF-011)", () => {
  it("repeated crash degrades search; the rebuild route recovers it", async () => {
    // Crash 1: automatic restart + rebuild brings search back on its own.
    await spawned[0]!.terminate();
    await vi.waitFor(() => expect(service.status().state).toBe("ready"), { timeout: 10_000 });
    expect(spawned).toHaveLength(2);

    // Crash 2: restart budget spent - degraded persists, editing unaffected.
    await spawned[1]!.terminate();
    await vi.waitFor(() => expect(service.status().state).toBe("degraded"), { timeout: 10_000 });

    const degraded = await app.inject({
      method: "GET",
      url: "/api/v1/search?q=runway",
      headers: headers(),
    });
    expect(degraded.statusCode).toBe(503);
    expect(degraded.json().error.code).toBe("SEARCH_DEGRADED");

    // Recovery screen action: explicit rebuild respawns and re-indexes.
    const rebuild = await app.inject({
      method: "POST",
      url: "/api/v1/search/rebuild",
      headers: { ...headers(), origin: "http://127.0.0.1:8989" },
    });
    expect(rebuild.statusCode).toBe(200);
    expect(rebuild.json().data.accepted).toBe(true);

    await vi.waitFor(() => expect(service.status().state).toBe("ready"), { timeout: 10_000 });

    const recovered = await app.inject({
      method: "GET",
      url: "/api/v1/search?q=runway",
      headers: headers(),
    });
    expect(recovered.statusCode).toBe(200);
    expect(recovered.json().data.total).toBe(1);
    expect(recovered.json().data.results[0].relativePath).toBe("runway.md");
  });
});
