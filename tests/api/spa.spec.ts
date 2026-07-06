import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/backend/app.js";
import { generateCapability } from "../../src/backend/security/capability.js";
import { LOCAL_HOST_HEADER } from "../../src/shared/constants/server.js";

/*
 * Packaged SPA serving (MasterPrompt.md 1.6 + 7.1): known client routes get
 * the nonce-injected index.html whose nonce matches the CSP header of the
 * SAME response; the raw template never leaks; unknown non-API paths 404;
 * hashed assets serve from the same root. Capability is NOT required for the
 * HTML shell - it arrives via the launch fragment.
 */
const TEMPLATE = [
  "<!doctype html>",
  '<html><head><meta name="csp-nonce" content="__CSP_NONCE__" /></head>',
  "<body><div id=\"root\"></div></body></html>",
].join("\n");

const CLIENT_ROUTES = ["/", "/notes/d2VsY29tZS5tZA", "/settings", "/recovery/search"];

function nonceOf(res: { headers: Record<string, unknown> }): string {
  const csp = String(res.headers["content-security-policy"]);
  const match = /'nonce-([^']+)'/.exec(csp);
  return match?.[1] ?? "";
}

describe("packaged SPA serving", () => {
  let app: FastifyInstance;
  let staticRoot: string;

  beforeEach(async () => {
    staticRoot = await mkdtemp(join(tmpdir(), "local-notes-spa-"));
    await writeFile(join(staticRoot, "index.html"), TEMPLATE, "utf8");
    await mkdir(join(staticRoot, "assets"));
    await writeFile(join(staticRoot, "assets", "index-abc.css"), "body{}", "utf8");
    app = await buildApp({ capability: generateCapability(), staticRoot });
  });

  afterEach(async () => {
    await app.close();
    await rm(staticRoot, { recursive: true, force: true });
  });

  for (const route of CLIENT_ROUTES) {
    it(`serves nonce-injected shell for known client route ${route}`, async () => {
      const res = await app.inject({
        method: "GET",
        url: route,
        headers: { host: LOCAL_HOST_HEADER },
      });
      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toContain("text/html");
      const nonce = nonceOf(res);
      expect(nonce).toBeTruthy();
      expect(res.body).toContain(`content="${nonce}"`);
      expect(res.body).not.toContain("__CSP_NONCE__");
    });
  }

  it("issues a fresh nonce per response", async () => {
    const first = await app.inject({ method: "GET", url: "/", headers: { host: LOCAL_HOST_HEADER } });
    const second = await app.inject({ method: "GET", url: "/", headers: { host: LOCAL_HOST_HEADER } });
    expect(nonceOf(first)).not.toBe(nonceOf(second));
  });

  it("never serves the raw template at /index.html", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/index.html",
      headers: { host: LOCAL_HOST_HEADER },
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns the envelope 404 for unknown non-API paths", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/definitely/not/a/route",
      headers: { host: LOCAL_HOST_HEADER },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("NOT_FOUND");
  });

  it("serves hashed assets from the static root", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/assets/index-abc.css",
      headers: { host: LOCAL_HOST_HEADER },
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe("body{}");
  });

  it("rejects malformed note keys with 404 instead of serving the shell", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/notes/../escape",
      headers: { host: LOCAL_HOST_HEADER },
    });
    expect(res.statusCode).toBe(404);
  });
});
