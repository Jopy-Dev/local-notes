import { afterEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/backend/app.js";
import { generateCapability } from "../../src/backend/security/capability.js";
import { LOCAL_HOST_HEADER } from "../../src/shared/constants/server.js";

/*
 * Server construction options (MasterPrompt.md 7.1): routing stays strict
 * about trailing slashes, and building the server prints no framework
 * deprecation warning - fastify 5.12 deprecated top-level router options
 * (FSTDEP022) in favor of `routerOptions`, which surfaced on every launch.
 */
describe("server construction options", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    vi.restoreAllMocks();
  });

  it("builds without emitting the FSTDEP022 router-options deprecation", async () => {
    const emitWarning = vi.spyOn(process, "emitWarning");
    app = await buildApp({ capability: generateCapability() });
    // process-warning calls emitWarning(message, name, code).
    const deprecations = emitWarning.mock.calls.filter((call) => call.some((arg) => String(arg).includes("FSTDEP022")));
    expect(deprecations).toEqual([]);
  });

  it("keeps trailing-slash routing strict", async () => {
    const capability = generateCapability();
    app = await buildApp({ capability });
    const headers = { host: LOCAL_HOST_HEADER, "x-local-notes-token": capability };
    const exact = await app.inject({ method: "GET", url: "/api/v1/health", headers });
    const slashed = await app.inject({ method: "GET", url: "/api/v1/health/", headers });
    expect(exact.statusCode).toBe(200);
    expect(slashed.statusCode).toBe(404);
  });
});
