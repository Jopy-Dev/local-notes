import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/backend/app.js";
import { MetadataCache } from "../../src/backend/filesystem/metadata-cache.js";
import { NoteRepository } from "../../src/backend/filesystem/note-repository.js";
import { WorkspacePathGuard } from "../../src/backend/filesystem/path-guard.js";
import { createSearchService } from "../../src/backend/search/create-search-service.js";
import type { SearchService } from "../../src/backend/search/search-service.js";
import { generateCapability } from "../../src/backend/security/index.js";
import { LOCAL_HOST_HEADER } from "../../src/shared/constants/server.js";
import { ensureDistBuilt } from "./dist-build.js";

/*
 * REQ-031 performance benchmarks (MasterPrompt.md 8.5) against the 10,000
 * note fixture with controlled size distribution and nested folders, running
 * the real worker-thread engine. METRIC-003: warm-index ranked search p95
 * under 100ms measured API-receive -> response. METRIC-002 (server portion):
 * warm-cache scan + index init + first authenticated response under the 2s
 * budget - browser interactive time rides on the Step 15 E2E pass. Evidence
 * lands under .qa/perf/ (gitignored, regenerable).
 */
const NOTE_COUNT = 10_000;
const SETUP_TIMEOUT_MS = 300_000;
const SEARCH_P95_BUDGET_MS = 100;
const STARTUP_BUDGET_MS = 2_000;

let root: string;
let capability: string;
let app: FastifyInstance;
let service: SearchService;
let warmStartupMs: number;

function noteContent(index: number): string {
  // Size distribution: mostly small notes, a mid tier, a few large ones.
  const base = `# Note ${index}\n\ntopic-${index % 97} keyword alpha budget runway analysis ${index}\n`;
  if (index % 1000 === 0) return base + "large ".repeat(30_000); // ~180 KiB x 10
  if (index % 50 === 0) return base + "medium ".repeat(1_400); // ~10 KiB x 200
  return base + "small filler words ".repeat(12); // ~300 B x rest
}

function seedFixture(notesDir: string): void {
  for (let folder = 0; folder < 20; folder += 1) {
    mkdirSync(join(notesDir, `area-${folder}`, "sub"), { recursive: true });
  }
  for (let index = 0; index < NOTE_COUNT; index += 1) {
    const dir = index % 3 === 0 ? join(`area-${index % 20}`, "sub") : `area-${index % 20}`;
    writeFileSync(join(notesDir, dir, `note-${index}.md`), noteContent(index));
  }
}

function percentile(samples: readonly number[], fraction: number): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1)]!;
}

function writeEvidence(name: string, payload: object): void {
  const dir = join(process.cwd(), ".qa", "perf");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), JSON.stringify(payload, null, 2));
}

beforeAll(async () => {
  ensureDistBuilt();
  root = mkdtempSync(join(tmpdir(), "ln-perf-"));
  const notesDir = join(root, "save-data", "notes");
  mkdirSync(join(root, "cache"), { recursive: true });
  seedFixture(notesDir);
  capability = generateCapability();

  const guard = await WorkspacePathGuard.create(root);
  const repository = new NoteRepository(guard, "save-data/notes");
  const metadataCache = new MetadataCache(join(root, "cache"));

  // Cold pass builds the disk caches (metadata + search index checkpoint).
  const cold = createSearchService({ guard, workspaceRoot: root, notesRelRoot: "save-data/notes" });
  const coldSnapshot = await repository.scan();
  await metadataCache.save(coldSnapshot);
  await cold.service.initialize(coldSnapshot);
  await cold.service.close(); // forces the dirty-index checkpoint save

  // Warm startup (METRIC-002 server portion): cache-assisted scan + index
  // init + app build + first authenticated response.
  const startedAt = performance.now();
  const warmRepository = new NoteRepository(guard, "save-data/notes");
  const warm = createSearchService({
    guard,
    workspaceRoot: root,
    notesRelRoot: "save-data/notes",
    notesFor: () => warmRepository.scan(),
  });
  service = warm.service;
  const warmSnapshot = await warmRepository.scan((await metadataCache.load()) ?? undefined);
  await service.initialize(warmSnapshot);
  app = await buildApp({
    capability,
    workspaceRoot: root,
    noteRepository: warmRepository,
    searchService: service,
  });
  const health = await app.inject({
    method: "GET",
    url: "/api/v1/health",
    headers: { host: LOCAL_HOST_HEADER, "x-local-notes-token": capability },
  });
  warmStartupMs = performance.now() - startedAt;
  if (health.statusCode !== 200) throw new Error(`health returned ${health.statusCode}`);
  expect(warm.engineKind).toBe("worker");
}, SETUP_TIMEOUT_MS);

afterAll(async () => {
  await app.close();
  await service.close();
  rmSync(root, { recursive: true, force: true, maxRetries: 5 });
});

describe("REQ-031 benchmarks (10k notes, worker engine)", () => {
  it("METRIC-003: warm ranked search p95 under 100ms", async () => {
    const queries = [
      "Note 4242", // exact title
      "topic-13", // partial token across many notes
      "budget runway", // content phrase
      "analysi", // distance-1 typo: exercises the fuzzy rescue pass
      "keyword alpha",
    ];
    const samples: number[] = [];
    for (let round = 0; round < 10; round += 1) {
      for (const query of queries) {
        const started = performance.now();
        const res = await app.inject({
          method: "GET",
          url: `/api/v1/search?q=${encodeURIComponent(query)}`,
          headers: { host: LOCAL_HOST_HEADER, "x-local-notes-token": capability },
        });
        samples.push(performance.now() - started);
        expect(res.statusCode).toBe(200);
      }
    }
    const p95 = percentile(samples, 0.95);
    writeEvidence("metric-003.json", {
      metric: "METRIC-003",
      fixtureNotes: NOTE_COUNT,
      samples: samples.length,
      p50Ms: Number(percentile(samples, 0.5).toFixed(2)),
      p95Ms: Number(p95.toFixed(2)),
      budgetMs: SEARCH_P95_BUDGET_MS,
      os: process.platform,
      node: process.versions.node,
      capturedAt: new Date().toISOString(),
    });
    expect(p95).toBeLessThan(SEARCH_P95_BUDGET_MS);
  }, 120_000);

  it("METRIC-002 (server portion): warm startup under the 2s budget", () => {
    writeEvidence("metric-002-server.json", {
      metric: "METRIC-002 (server portion: warm scan + index init + first response)",
      fixtureNotes: NOTE_COUNT,
      durationMs: Number(warmStartupMs.toFixed(2)),
      budgetMs: STARTUP_BUDGET_MS,
      note: "browser bootstrap interactive mark rides on the Step 15 E2E pass",
      os: process.platform,
      node: process.versions.node,
      capturedAt: new Date().toISOString(),
    });
    expect(warmStartupMs).toBeLessThan(STARTUP_BUDGET_MS);
  });

  it("search results stay ranked and complete at 10k scale", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/search?q=Note%204242",
      headers: { host: LOCAL_HOST_HEADER, "x-local-notes-token": capability },
    });
    const body = res.json();
    // Title derives from the filename (note-4242.md), not the markdown heading.
    expect(body.data.results[0].title).toBe("note-4242");
    expect(body.data.results.length).toBeLessThanOrEqual(200);
  }, 30_000);
});
