import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/backend/app.js";
import { NoteRepository } from "../../src/backend/filesystem/note-repository.js";
import { WorkspacePathGuard } from "../../src/backend/filesystem/path-guard.js";
import { generateCapability } from "../../src/backend/security/capability.js";
import { LOCAL_HOST_HEADER } from "../../src/shared/constants/server.js";

/*
 * Notes/folders read routes (MasterPrompt.md 5.2, WF-001): metadata pages of
 * <=500 with opaque cursor; existing folder tree; invalid query -> 400.
 */
let root: string;
let app: FastifyInstance;
let capability: string;

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), "ln-routes-"));
  const notes = join(root, "save-data", "notes");
  mkdirSync(join(notes, "projects"), { recursive: true });
  for (let index = 0; index < 7; index += 1) {
    writeFileSync(join(notes, `note-${index}.md`), `content ${index}`);
  }
  writeFileSync(join(notes, "projects", "inner.txt"), "inner");
  capability = generateCapability();
  const guard = await WorkspacePathGuard.create(root);
  app = await buildApp({
    capability,
    workspaceRoot: root,
    noteRepository: new NoteRepository(guard, "save-data/notes"),
  });
});

afterEach(async () => {
  await app.close();
  rmSync(root, { recursive: true, force: true });
});

const headers = () => ({ host: LOCAL_HOST_HEADER, "x-local-notes-token": capability });

describe("GET /api/v1/notes", () => {
  it("returns a sorted metadata page with total count", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/notes", headers: headers() });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.total).toBe(8);
    expect(body.data.notes.length).toBe(8);
    expect(body.data.nextCursor).toBeNull();
    expect(body.data.notes[0].versionToken).toMatch(/^[a-f0-9]{64}$/);
  });

  it("pages with limit + opaque cursor preserving order", async () => {
    const first = await app.inject({
      method: "GET",
      url: "/api/v1/notes?limit=3&sort=name&direction=asc",
      headers: headers(),
    });
    const page1 = first.json().data;
    expect(page1.notes.length).toBe(3);
    expect(page1.nextCursor).toBeTruthy();
    const second = await app.inject({
      method: "GET",
      url: `/api/v1/notes?limit=3&sort=name&direction=asc&cursor=${page1.nextCursor}`,
      headers: headers(),
    });
    const page2 = second.json().data;
    expect(page2.notes[0].filename > page1.notes[2].filename).toBe(true);
  });

  it("rejects invalid query values with 400 INVALID_QUERY", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/notes?limit=9999",
      headers: headers(),
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("INVALID_QUERY");
  });

  it("folder param scopes the page and total to that folder and its descendants (WF-001)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/notes?folder=projects",
      headers: headers(),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json().data;
    expect(body.total).toBe(1);
    expect(body.notes.map((note: { relativePath: string }) => note.relativePath)).toEqual([
      "projects/inner.txt",
    ]);
  });

  it("unknown folder returns an empty page, not an error", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/notes?folder=missing",
      headers: headers(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.total).toBe(0);
    expect(res.json().data.nextCursor).toBeNull();
  });
});

describe("GET /api/v1/folders", () => {
  it("returns the existing active folder tree with direct note counts", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/folders", headers: headers() });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.folders).toEqual(["projects"]);
    expect(res.json().data.counts).toEqual({ projects: 1 });
    expect(res.json().data.total).toBe(8);
  });
});
