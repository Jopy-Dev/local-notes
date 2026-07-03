import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/backend/app.js";
import { NoteMutationService } from "../../src/backend/filesystem/note-mutations.js";
import { NoteRepository } from "../../src/backend/filesystem/note-repository.js";
import { encodeNoteKey, WorkspacePathGuard } from "../../src/backend/filesystem/path-guard.js";
import { generateCapability } from "../../src/backend/security/capability.js";
import { LOCAL_HOST_HEADER, LOCAL_ORIGIN } from "../../src/shared/constants/server.js";

/*
 * Mutation routes (MasterPrompt.md 5.2, WF-003/008/009): create/move/archive
 * with collision and validation error contracts; Origin required.
 */
let root: string;
let app: FastifyInstance;
let capability: string;

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), "ln-mutroutes-"));
  const notes = join(root, "save-data", "notes");
  mkdirSync(join(notes, "projects"), { recursive: true });
  mkdirSync(join(root, "save-data", "archive"), { recursive: true });
  writeFileSync(join(notes, "existing.md"), "body", "utf8");
  capability = generateCapability();
  const guard = await WorkspacePathGuard.create(root);
  app = await buildApp({
    capability,
    workspaceRoot: root,
    noteRepository: new NoteRepository(guard, "save-data/notes"),
    mutationService: new NoteMutationService(guard),
  });
});

afterEach(async () => {
  await app.close();
  rmSync(root, { recursive: true, force: true });
});

const headers = () => ({
  host: LOCAL_HOST_HEADER,
  origin: LOCAL_ORIGIN,
  "x-local-notes-token": capability,
  "content-type": "application/json",
});

describe("POST /api/v1/notes", () => {
  it("creates a note and returns its metadata", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/notes",
      headers: headers(),
      payload: { filename: "fresh", extension: ".md", folderKey: "projects" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.relativePath).toBe("projects/fresh.md");
  });

  it("maps collision to 409 NOTE_EXISTS and bad names to 422 INVALID_FILENAME", async () => {
    const dup = await app.inject({
      method: "POST",
      url: "/api/v1/notes",
      headers: headers(),
      payload: { filename: "EXISTING", extension: ".md", folderKey: "" },
    });
    expect(dup.statusCode).toBe(409);
    expect(dup.json().error.code).toBe("NOTE_EXISTS");

    const bad = await app.inject({
      method: "POST",
      url: "/api/v1/notes",
      headers: headers(),
      payload: { filename: "no|pipe", extension: ".md", folderKey: "" },
    });
    expect(bad.statusCode).toBe(422);
    expect(bad.json().error.code).toBe("INVALID_FILENAME");
  });
});

describe("POST /api/v1/notes/:noteKey/move", () => {
  it("moves the note and returns new metadata", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/notes/${encodeNoteKey("existing.md")}/move`,
      headers: headers(),
      payload: { destinationFolderKey: "projects", operationId: randomUUID() },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.relativePath).toBe("projects/existing.md");
    expect(readFileSync(join(root, "save-data", "notes", "projects", "existing.md"), "utf8")).toBe(
      "body",
    );
  });

  it("missing destination folder maps to 404 FOLDER_NOT_FOUND", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/notes/${encodeNoteKey("existing.md")}/move`,
      headers: headers(),
      payload: { destinationFolderKey: "ghost", operationId: randomUUID() },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("FOLDER_NOT_FOUND");
  });
});

describe("POST /api/v1/notes/:noteKey/archive", () => {
  it("archives and returns the archived relative path", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/notes/${encodeNoteKey("existing.md")}/archive`,
      headers: headers(),
      payload: { operationId: randomUUID() },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.archivedRelativePath).toBe("existing.md");
  });

  it("collision maps to 409 ARCHIVE_COLLISION with renameAllowed", async () => {
    writeFileSync(join(root, "save-data", "archive", "existing.md"), "old", "utf8");
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/notes/${encodeNoteKey("existing.md")}/archive`,
      headers: headers(),
      payload: { operationId: randomUUID() },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe("ARCHIVE_COLLISION");
    expect(res.json().error.renameAllowed).toBe(true);
  });
});
