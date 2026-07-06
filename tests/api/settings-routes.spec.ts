import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/backend/app.js";
import { ConfigService } from "../../src/backend/config/config-service.js";
import { EventBus } from "../../src/backend/events/event-bus.js";
import type { WorkspaceEvent } from "../../src/backend/events/event-bus.js";
import { generateCapability } from "../../src/backend/security/capability.js";
import { LOCAL_HOST_HEADER, LOCAL_ORIGIN } from "../../src/shared/constants/server.js";

/*
 * Settings routes (MasterPrompt.md 5.2, WF-010, REQ-021/022/034): GET returns
 * ConfigV1; PUT validates partial updates, persists atomically, publishes
 * settings.changed, and never lets the client touch workspace/version.
 */
let root: string;
let app: FastifyInstance;
let capability: string;
let bus: EventBus;
let events: WorkspaceEvent[];

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), "ln-settings-routes-"));
  capability = generateCapability();
  bus = new EventBus();
  events = [];
  bus.subscribe((event) => events.push(event));
  app = await buildApp({
    capability,
    workspaceRoot: root,
    configService: new ConfigService(root),
    eventBus: bus,
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

describe("GET /api/v1/settings", () => {
  it("returns the persisted ConfigV1 with exact REQ-021/034 defaults", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/settings", headers: headers() });
    expect(res.statusCode).toBe(200);
    const { data } = res.json();
    expect(data).toMatchObject({
      version: 1,
      theme: "system",
      editorFontSize: 14,
      lineHeight: 1.6,
      folderPaneWidth: 220,
      notesPaneWidth: 320,
      folderPaneCollapsed: false,
      notesPaneCollapsed: false,
    });
  });
});

describe("PUT /api/v1/settings", () => {
  it("applies a partial update, persists it, and publishes settings.changed", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/v1/settings",
      headers: headers(),
      payload: { theme: "dark", folderPaneWidth: 260 },
    });
    expect(res.statusCode).toBe(200);
    const { data } = res.json();
    expect(data.theme).toBe("dark");
    expect(data.folderPaneWidth).toBe(260);
    // Untouched fields survive the merge.
    expect(data.notesPaneWidth).toBe(320);
    // Persisted on disk, not just in memory.
    const onDisk = JSON.parse(readFileSync(join(root, "config.json"), "utf8"));
    expect(onDisk.theme).toBe("dark");
    expect(events).toContainEqual({ type: "settings.changed" });
  });

  it("rejects an out-of-range value with 422 INVALID_SETTING and a field error", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/v1/settings",
      headers: headers(),
      payload: { editorFontSize: 40 },
    });
    expect(res.statusCode).toBe(422);
    const { error } = res.json();
    expect(error.code).toBe("INVALID_SETTING");
    expect(error.fieldErrors.editorFontSize).toBeDefined();
    expect(events).toHaveLength(0);
  });

  it("rejects workspace and version as client-writable fields", async () => {
    for (const payload of [{ workspace: "C:/elsewhere" }, { version: 2 }]) {
      const res = await app.inject({
        method: "PUT",
        url: "/api/v1/settings",
        headers: headers(),
        payload,
      });
      expect(res.statusCode).toBe(422);
      expect(res.json().error.code).toBe("INVALID_SETTING");
    }
  });

  it("rejects unknown keys instead of silently dropping them", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/v1/settings",
      headers: headers(),
      payload: { telemetry: true },
    });
    expect(res.statusCode).toBe(422);
  });

  it("requires the capability token", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/v1/settings",
      headers: { host: LOCAL_HOST_HEADER, origin: LOCAL_ORIGIN, "content-type": "application/json" },
      payload: { theme: "dark" },
    });
    expect(res.statusCode).toBe(401);
  });
});
