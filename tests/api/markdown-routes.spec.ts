import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/backend/app.js";
import { encodeNoteKey, WorkspacePathGuard } from "../../src/backend/filesystem/path-guard.js";
import { MarkdownRenderService } from "../../src/backend/markdown/render-service.js";
import { generateCapability } from "../../src/backend/security/capability.js";
import { LOCAL_HOST_HEADER, LOCAL_ORIGIN } from "../../src/shared/constants/server.js";

/*
 * Markdown render + guarded asset routes (MasterPrompt.md 4.6, 5.2, REQ-028):
 * POST /markdown/render sanitizes server-side; GET /assets/:assetKey serves
 * allowlisted raster images inside save-data only.
 */
let root: string;
let app: FastifyInstance;
let capability: string;

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), "ln-markdown-routes-"));
  mkdirSync(join(root, "save-data", "notes", "docs"), { recursive: true });
  writeFileSync(join(root, "save-data", "notes", "docs", "guide.md"), "# Guide", "utf8");
  capability = generateCapability();
  const guard = await WorkspacePathGuard.create(root);
  app = await buildApp({
    capability,
    workspaceRoot: root,
    markdownService: new MarkdownRenderService(guard),
  });
});

afterEach(async () => {
  await app.close();
  rmSync(root, { recursive: true, force: true });
});

const noteKey = () => encodeNoteKey("docs/guide.md");
const renderHeaders = () => ({
  host: LOCAL_HOST_HEADER,
  origin: LOCAL_ORIGIN,
  "x-local-notes-token": capability,
  "content-type": "text/plain; charset=utf-8",
  "x-note-key": noteKey(),
});

// Minimal valid 1x1 PNG (signature + IHDR/IDAT/IEND) for signature checks.
const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

describe("GET /api/v1/assets/:assetKey", () => {
  const assetHeaders = () => ({ host: LOCAL_HOST_HEADER, "x-local-notes-token": capability });

  it("serves an allowlisted raster image with hardened headers", async () => {
    mkdirSync(join(root, "save-data", "notes", "docs", "images"), { recursive: true });
    writeFileSync(join(root, "save-data", "notes", "docs", "images", "shot.png"), PNG_BYTES);
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/assets/${encodeNoteKey("notes/docs/images/shot.png")}`,
      headers: assetHeaders(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("image/png");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["cache-control"]).toContain("no-store");
    expect(res.headers["content-disposition"]).toBe("inline");
    expect(res.rawPayload.subarray(0, 4)).toEqual(PNG_BYTES.subarray(0, 4));
  });

  it("missing asset returns 404 ASSET_NOT_FOUND", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/assets/${encodeNoteKey("notes/docs/images/ghost.png")}`,
      headers: assetHeaders(),
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("ASSET_NOT_FOUND");
  });

  it("blocks SVG as active content with 403 ASSET_BLOCKED", async () => {
    writeFileSync(join(root, "save-data", "notes", "docs", "vector.svg"), "<svg></svg>", "utf8");
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/assets/${encodeNoteKey("notes/docs/vector.svg")}`,
      headers: assetHeaders(),
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe("ASSET_BLOCKED");
  });

  it("blocks signature/extension mismatch (HTML disguised as png)", async () => {
    writeFileSync(
      join(root, "save-data", "notes", "docs", "fake.png"),
      "<html><script>alert(1)</script></html>",
      "utf8",
    );
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/assets/${encodeNoteKey("notes/docs/fake.png")}`,
      headers: assetHeaders(),
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe("ASSET_BLOCKED");
  });

  it("blocks traversal in the decoded asset key", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/assets/${Buffer.from("../config.json").toString("base64url")}`,
      headers: assetHeaders(),
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("POST /api/v1/markdown/render", () => {
  it("returns server-sanitized HTML for GFM markdown", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/markdown/render",
      headers: renderHeaders(),
      payload: "# Hello\n\n- [x] done",
    });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.html).toContain("<h1>Hello</h1>");
    expect(data.html).toContain("checkbox");
    expect(data.compatibility).toBe("edit");
  });
});
