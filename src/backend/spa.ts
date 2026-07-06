import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fastifyStatic from "@fastify/static";

/*
 * Packaged SPA serving (MasterPrompt.md 1.6 + 7.1): index.html is a template
 * carrying a __CSP_NONCE__ placeholder; every known client route serves it
 * with the per-response nonce injected (matching the CSP header built in
 * security/boundary.ts) so CodeMirror/ProseMirror style injection passes
 * style-src. The raw template never leaves the process; unknown non-API
 * paths fall through to the envelope 404.
 */
const CLIENT_ROUTES = ["/", "/settings", "/recovery/search"];
// Mirror of src/frontend/app/routes.ts noteKey acceptance (opaque base64url).
const NOTE_KEY_PATTERN = /^[A-Za-z0-9_-]+$/;
const NONCE_PLACEHOLDER = /__CSP_NONCE__/g;

export async function registerSpa(app: FastifyInstance, staticRoot: string): Promise<void> {
  const template = await readFile(join(staticRoot, "index.html"), "utf8");

  await app.register(fastifyStatic, {
    root: staticRoot,
    index: false,
    dotfiles: "deny",
    list: false,
    // Only the nonce-injected handlers may emit the shell (7.1).
    allowedPath: (pathName) => pathName !== "/index.html",
  });

  const sendShell = (request: FastifyRequest, reply: FastifyReply) =>
    reply
      .type("text/html; charset=utf-8")
      // Nonce is per-response; the shell must never be cached.
      .header("cache-control", "no-store")
      .send(template.replace(NONCE_PLACEHOLDER, request.cspNonce));

  for (const route of CLIENT_ROUTES) {
    app.get(route, sendShell);
  }
  app.get("/notes/:noteKey", (request, reply) => {
    const { noteKey } = request.params as { noteKey: string };
    if (!NOTE_KEY_PATTERN.test(noteKey)) return reply.callNotFound();
    return sendShell(request, reply);
  });
}
