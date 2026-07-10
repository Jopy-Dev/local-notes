import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  API_PREFIX,
  CAPABILITY_HEADER,
  LOCAL_HOST_HEADER,
  LOCAL_ORIGIN,
} from "../../shared/constants/server.js";
import { AppError } from "../../shared/errors/codes.js";
import { generateNonce, verifyCapability } from "./index.js";
import { buildSecurityHeaders } from "./headers.js";

/*
 * Request boundary (ADR-003, MasterPrompt.md 3 + 7.1): Host check before
 * routing; capability verification before any body parsing on API paths;
 * exact-Origin equality on mutations; security headers on every response.
 */
function assertHost(request: FastifyRequest): void {
  if (request.headers.host !== LOCAL_HOST_HEADER) {
    throw new AppError("HOST_NOT_ALLOWED", "Request host is not the local application address.");
  }
}

function assertApiAccess(request: FastifyRequest, capability: string): void {
  if (!request.url.startsWith(API_PREFIX)) return;
  const token = request.headers[CAPABILITY_HEADER];
  // Node joins duplicated headers into "a, b" - a joined, missing, or
  // otherwise non-string value fails verification closed.
  if (!verifyCapability(typeof token === "string" ? token : undefined, capability)) {
    throw new AppError("LOCAL_ACCESS_REQUIRED", "Local access token missing or invalid.");
  }
  const method = request.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD" && request.headers.origin !== LOCAL_ORIGIN) {
    throw new AppError("ORIGIN_NOT_ALLOWED", "Mutations require the local application origin.");
  }
}

declare module "fastify" {
  interface FastifyRequest {
    /* Per-response CSP nonce; the SPA shell handler injects the same value
     * into index.html so runtime style injection (CodeMirror/ProseMirror)
     * passes style-src (MasterPrompt.md 7.1). */
    cspNonce: string;
  }
}

export function registerBoundary(app: FastifyInstance, capability: string): void {
  app.decorateRequest("cspNonce", "");
  app.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
    assertHost(request);
    assertApiAccess(request, capability);
    const nonce = generateNonce();
    request.cspNonce = nonce;
    reply.headers(buildSecurityHeaders(nonce));
  });
}
