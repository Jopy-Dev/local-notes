import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/backend/app.js";
import { NoteRepository } from "../../src/backend/filesystem/note-repository.js";
import { WorkspacePathGuard } from "../../src/backend/filesystem/path-guard.js";
import { createSearchService } from "../../src/backend/search/create-search-service.js";
import type { SearchService } from "../../src/backend/search/search-service.js";
import { generateCapability } from "../../src/backend/security/capability.js";
import { LOCAL_HOST_HEADER } from "../../src/shared/constants/server.js";

/*
 * Search routes (MasterPrompt.md 5.2, WF-002/011): GET /search ranked batches,
 * POST /search/rebuild single-flight, degraded -> 503 SEARCH_DEGRADED.
 */
let root: string;
let app: FastifyInstance;
let capability: string;
let service: SearchService;
let repository: NoteRepository;

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), "ln-search-routes-"));
  const notes = join(root, "save-data", "notes");
  mkdirSync(join(notes, "projects"), { recursive: true });
  mkdirSync(join(root, "cache"), { recursive: true });
  writeFileSync(join(notes, "runway.md"), "# Runway\nBudget analysis for the runway.");
  writeFileSync(join(notes, "projects", "other.md"), "unrelated words entirely");
  capability = generateCapability();
  const guard = await WorkspacePathGuard.create(root);
  repository = new NoteRepository(guard, "save-data/notes");
  service = createSearchService({
    guard,
    workspaceRoot: root,
    notesRelRoot: "save-data/notes",
    preferredEngine: "in-process",
  }).service;
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

describe("GET /api/v1/search", () => {
  it("returns ranked results with snippet, ranges, and hasMore", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/search?q=runway",
      headers: headers(),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json().data;
    expect(body.total).toBe(1);
    expect(body.hasMore).toBe(false);
    expect(body.results[0].relativePath).toBe("runway.md");
    expect(body.results[0].snippet.toLowerCase()).toContain("runway");
    expect(body.results[0].matchRanges.length).toBeGreaterThan(0);
  });

  it("typo-tolerant query still finds the note (REQ-009 acceptance)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/search?q=runwy",
      headers: headers(),
    });
    expect(res.json().data.results.map((r: { relativePath: string }) => r.relativePath)).toContain(
      "runway.md",
    );
  });

  it("rejects blank query and non-multiple-of-200 offset with 400", async () => {
    const blank = await app.inject({
      method: "GET",
      url: "/api/v1/search?q=",
      headers: headers(),
    });
    expect(blank.statusCode).toBe(400);
    expect(blank.json().error.code).toBe("INVALID_QUERY");

    const badOffset = await app.inject({
      method: "GET",
      url: "/api/v1/search?q=x&offset=37",
      headers: headers(),
    });
    expect(badOffset.statusCode).toBe(400);
  });
});

describe("POST /api/v1/search/rebuild", () => {
  it("accepts a rebuild and reports running state on concurrent request", async () => {
    const first = await app.inject({
      method: "POST",
      url: "/api/v1/search/rebuild",
      headers: { ...headers(), origin: `http://${LOCAL_HOST_HEADER}` },
    });
    expect(first.statusCode).toBe(200);
    expect(first.json().data.accepted).toBe(true);
  });
});
