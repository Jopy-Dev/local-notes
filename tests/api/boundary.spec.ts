import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/backend/app.js";
import { generateCapability } from "../../src/backend/security/capability.js";
import { LOCAL_HOST_HEADER, LOCAL_ORIGIN } from "../../src/shared/constants/server.js";

/*
 * Request boundary (MasterPrompt.md 3 + 7.1, ADR-003): capability before body
 * parse, Host before routing, Origin on mutations, security headers on every
 * response, uniform error envelope.
 */
const validHeaders = (capability: string) => ({
  host: LOCAL_HOST_HEADER,
  "x-local-notes-token": capability,
});

describe("request boundary", () => {
  let app: FastifyInstance;
  let capability: string;

  beforeEach(async () => {
    capability = generateCapability();
    app = await buildApp({ capability });
  });

  afterEach(async () => {
    await app.close();
  });

  it("rejects /api/v1 requests without token: 401 LOCAL_ACCESS_REQUIRED", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/health",
      headers: { host: LOCAL_HOST_HEADER },
    });
    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.error.code).toBe("LOCAL_ACCESS_REQUIRED");
    expect(body.requestId).toBeTruthy();
  });

  it("rejects a wrong token: 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/health",
      headers: { host: LOCAL_HOST_HEADER, "x-local-notes-token": generateCapability() },
    });
    expect(res.statusCode).toBe(401);
  });

  it("rejects unexpected Host before routing: 403 HOST_NOT_ALLOWED", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/health",
      headers: { host: "evil.example:8989", "x-local-notes-token": capability },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe("HOST_NOT_ALLOWED");
  });

  it("serves authorized requests and sets security headers", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/health",
      headers: validHeaders(capability),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe("ok");
    expect(res.headers["content-security-policy"]).toContain("default-src 'self'");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("DENY");
    expect(res.headers["referrer-policy"]).toBe("no-referrer");
    expect(res.headers["permissions-policy"]).toContain("camera=()");
  });

  it("rejects mutations without exact Origin: 403 ORIGIN_NOT_ALLOWED", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/anything",
      headers: { ...validHeaders(capability), origin: "http://localhost:8989" },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe("ORIGIN_NOT_ALLOWED");
  });

  it("accepts the exact loopback Origin on mutations (404 for unknown route, not 403)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/anything",
      headers: { ...validHeaders(capability), origin: LOCAL_ORIGIN },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("NOT_FOUND");
  });

  it("returns uniform envelope with requestId on unknown API routes", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/nope",
      headers: validHeaders(capability),
    });
    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.requestId).toBeTruthy();
  });
});
