import { mkdirSync, mkdtempSync, existsSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/backend/app.js";
import { NoteContentService } from "../../src/backend/filesystem/note-content.js";
import { NoteMutationService } from "../../src/backend/filesystem/note-mutations.js";
import { NoteRepository } from "../../src/backend/filesystem/note-repository.js";
import { encodeNoteKey, WorkspacePathGuard } from "../../src/backend/filesystem/path-guard.js";
import { generateCapability } from "../../src/backend/security/capability.js";
import { LOCAL_HOST_HEADER, LOCAL_ORIGIN } from "../../src/shared/constants/server.js";

/*
 * Archive routes (round 2, SCREEN-008): archive listing scope, read-only
 * archived content, restore into the active tree, delete to the recycle bin
 * (trash function injected - tests never touch the real recycle bin).
 */
let root: string;
let app: FastifyInstance;
let capability: string;
let trashed: string[];

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), "ln-archive-routes-"));
  const notes = join(root, "save-data", "notes");
  const archive = join(root, "save-data", "archive");
  mkdirSync(join(notes, "projects"), { recursive: true });
  mkdirSync(join(archive, "projects"), { recursive: true });
  writeFileSync(join(notes, "active.md"), "# Active");
  writeFileSync(join(archive, "old-plan.md"), "# Old plan\n\ncontent");
  writeFileSync(join(archive, "projects", "retired.txt"), "retired text");
  trashed = [];
  capability = generateCapability();
  const guard = await WorkspacePathGuard.create(root);
  app = await buildApp({
    capability,
    workspaceRoot: root,
    noteRepository: new NoteRepository(guard, "save-data/notes"),
    archiveRepository: new NoteRepository(guard, "save-data/archive"),
    archiveContentService: new NoteContentService(guard, "save-data/archive"),
    mutationService: new NoteMutationService(guard, async (path) => {
      trashed.push(path);
      rmSync(path);
    }),
  });
});

afterEach(async () => {
  await app.close();
  rmSync(root, { recursive: true, force: true });
});

const headers = () => ({ host: LOCAL_HOST_HEADER, "x-local-notes-token": capability });
const mutationHeaders = () => ({
  ...headers(),
  origin: LOCAL_ORIGIN,
  "content-type": "application/json",
});

describe("GET /api/v1/notes?archived=true", () => {
  it("lists the archive tree instead of the active tree", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/notes?archived=true",
      headers: headers(),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json().data;
    expect(body.total).toBe(2);
    const paths = body.notes.map((note: { relativePath: string }) => note.relativePath).sort();
    expect(paths).toEqual(["old-plan.md", "projects/retired.txt"]);
  });

  it("folders response carries the archived count", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/folders", headers: headers() });
    expect(res.json().data.archived).toBe(2);
  });
});

describe("GET /api/v1/archive/:noteKey", () => {
  it("returns the archived NoteDocument", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/archive/${encodeNoteKey("old-plan.md")}`,
      headers: headers(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.content).toBe("# Old plan\n\ncontent");
  });

  it("missing archived note returns 404 NOTE_NOT_FOUND", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/archive/${encodeNoteKey("ghost.md")}`,
      headers: headers(),
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("NOTE_NOT_FOUND");
  });
});

describe("POST /api/v1/archive/:noteKey/restore", () => {
  it("moves the note into the active folder and returns fresh metadata", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/archive/${encodeNoteKey("old-plan.md")}/restore`,
      headers: mutationHeaders(),
      payload: { destinationFolderKey: "projects", operationId: crypto.randomUUID() },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.relativePath).toBe("projects/old-plan.md");
    expect(existsSync(join(root, "save-data", "notes", "projects", "old-plan.md"))).toBe(true);
    expect(existsSync(join(root, "save-data", "archive", "old-plan.md"))).toBe(false);
  });

  it("destination collision returns 409 NOTE_EXISTS and changes nothing", async () => {
    writeFileSync(join(root, "save-data", "notes", "old-plan.md"), "already here");
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/archive/${encodeNoteKey("old-plan.md")}/restore`,
      headers: mutationHeaders(),
      payload: { destinationFolderKey: "", operationId: crypto.randomUUID() },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe("NOTE_EXISTS");
    expect(existsSync(join(root, "save-data", "archive", "old-plan.md"))).toBe(true);
  });
});

describe("DELETE /api/v1/archive/:noteKey", () => {
  it("hands the file to the trash function and reports success", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/archive/${encodeNoteKey("old-plan.md")}`,
      headers: { ...headers(), origin: LOCAL_ORIGIN },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.deleted).toBe(true);
    expect(trashed).toEqual([join(root, "save-data", "archive", "old-plan.md")]);
  });

  it("requires the local origin like every mutation", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/archive/${encodeNoteKey("old-plan.md")}`,
      headers: headers(),
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe("ORIGIN_NOT_ALLOWED");
    expect(trashed).toEqual([]);
  });

  it("never deletes from the active tree - active keys 404 against the archive root", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/archive/${encodeNoteKey("active.md")}`,
      headers: { ...headers(), origin: LOCAL_ORIGIN },
    });
    expect(res.statusCode).toBe(404);
    expect(trashed).toEqual([]);
    expect(existsSync(join(root, "save-data", "notes", "active.md"))).toBe(true);
  });
});
