import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/backend/app.js";
import { NoteContentService } from "../../src/backend/filesystem/note-content.js";
import { encodeNoteKey, WorkspacePathGuard } from "../../src/backend/filesystem/path-guard.js";
import { generateCapability } from "../../src/backend/security/capability.js";
import { LOCAL_HOST_HEADER, LOCAL_ORIGIN } from "../../src/shared/constants/server.js";

/*
 * Content routes (MasterPrompt.md 5.2, WF-005/006): GET NoteDocument, PUT
 * raw text with If-Match version + X-Operation-ID, conflict and read-only
 * contracts.
 */
let root: string;
let app: FastifyInstance;
let capability: string;

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), "ln-content-routes-"));
  mkdirSync(join(root, "save-data", "notes"), { recursive: true });
  writeFileSync(join(root, "save-data", "notes", "note.md"), "# Hello\nworld", "utf8");
  capability = generateCapability();
  const guard = await WorkspacePathGuard.create(root);
  app = await buildApp({
    capability,
    workspaceRoot: root,
    contentService: new NoteContentService(guard),
  });
});

afterEach(async () => {
  await app.close();
  rmSync(root, { recursive: true, force: true });
});

const key = () => encodeNoteKey("note.md");
const headers = () => ({ host: LOCAL_HOST_HEADER, "x-local-notes-token": capability });

describe("GET /api/v1/notes/:noteKey", () => {
  it("returns the NoteDocument", async () => {
    const res = await app.inject({ method: "GET", url: `/api/v1/notes/${key()}`, headers: headers() });
    expect(res.statusCode).toBe(200);
    const doc = res.json().data;
    expect(doc.content).toBe("# Hello\nworld");
    expect(doc.markdownCompatibility).toBe("source-only");
    expect(doc.versionToken).toMatch(/^[a-f0-9]{64}$/);
  });

  it("missing note returns 404 NOTE_NOT_FOUND", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/notes/${encodeNoteKey("ghost.md")}`,
      headers: headers(),
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("NOTE_NOT_FOUND");
  });
});

describe("PUT /api/v1/notes/:noteKey/content", () => {
  it("saves the draft with If-Match and returns fresh metadata", async () => {
    const doc = (
      await app.inject({ method: "GET", url: `/api/v1/notes/${key()}`, headers: headers() })
    ).json().data;
    const res = await app.inject({
      method: "PUT",
      url: `/api/v1/notes/${key()}/content`,
      headers: {
        ...headers(),
        origin: LOCAL_ORIGIN,
        "content-type": "text/plain; charset=utf-8",
        "if-match": doc.versionToken,
        "x-operation-id": randomUUID(),
      },
      payload: "# Hello\nsaved draft",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.versionToken).not.toBe(doc.versionToken);
    expect(readFileSync(join(root, "save-data", "notes", "note.md"), "utf8")).toBe(
      "# Hello\nsaved draft",
    );
  });

  it("stale If-Match returns 409 NOTE_CONFLICT and leaves the file", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/api/v1/notes/${key()}/content`,
      headers: {
        ...headers(),
        origin: LOCAL_ORIGIN,
        "content-type": "text/plain; charset=utf-8",
        "if-match": "0".repeat(64),
        "x-operation-id": randomUUID(),
      },
      payload: "should not land",
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe("NOTE_CONFLICT");
    expect(readFileSync(join(root, "save-data", "notes", "note.md"), "utf8")).toBe("# Hello\nworld");
  });

  it("missing If-Match returns 400 INVALID_QUERY", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/api/v1/notes/${key()}/content`,
      headers: {
        ...headers(),
        origin: LOCAL_ORIGIN,
        "content-type": "text/plain; charset=utf-8",
      },
      payload: "draft",
    });
    expect(res.statusCode).toBe(400);
  });
});
