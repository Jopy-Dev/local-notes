import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/backend/app.js";
import { ConfigService } from "../../src/backend/config/config-service.js";
import { generateCapability } from "../../src/backend/security/capability.js";
import { LOCAL_HOST_HEADER } from "../../src/shared/constants/server.js";

// System routes: /health, /bootstrap, static SPA serving (MasterPrompt.md 5.2).
describe("system routes", () => {
  let app: FastifyInstance;
  let capability: string;

  beforeEach(async () => {
    capability = generateCapability();
    app = await buildApp({ capability });
  });

  afterEach(async () => {
    await app.close();
  });

  const headers = () => ({ host: LOCAL_HOST_HEADER, "x-local-notes-token": capability });

  it("serves /api/v1/bootstrap with config defaults and never leaks the capability", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/bootstrap", headers: headers() });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.config.theme).toBe("system");
    expect(body.data.config.editorFontSize).toBe(14);
    expect(body.data.workspaceDisplayPath).toContain(".local-notes");
    expect(res.body).not.toContain(capability);
  });

  it("returns persisted ConfigV1 through /bootstrap when the config service is wired", async () => {
    const workspaceRoot = mkdtempSync(join(tmpdir(), "local-notes-ws-"));
    const service = new ConfigService(workspaceRoot);
    await service.load();
    await service.update({ theme: "dark" });
    const wired = await buildApp({ capability, workspaceRoot, configService: service });
    const res = await wired.inject({
      method: "GET",
      url: "/api/v1/bootstrap",
      headers: headers(),
    });
    expect(res.json().data.config.theme).toBe("dark");
    await wired.close();
    rmSync(workspaceRoot, { recursive: true, force: true });
  });

  it("serves the SPA via static registration without a token (script tags cannot set headers)", async () => {
    const staticRoot = mkdtempSync(join(tmpdir(), "local-notes-static-"));
    writeFileSync(join(staticRoot, "index.html"), "<!doctype html><title>Local-Notes</title>");
    const staticApp = await buildApp({ capability, staticRoot });
    const res = await staticApp.inject({
      method: "GET",
      url: "/",
      headers: { host: LOCAL_HOST_HEADER },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
    await staticApp.close();
    rmSync(staticRoot, { recursive: true, force: true });
  });
});
