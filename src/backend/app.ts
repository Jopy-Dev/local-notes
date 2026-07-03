import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";
import { registerSystemRoutes } from "./routes/system.js";
import Fastify from "fastify";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fastifyStatic from "@fastify/static";
import {
  API_PREFIX,
  BODY_LIMIT_BYTES,
  CAPABILITY_HEADER,
  LOCAL_HOST_HEADER,
  LOCAL_ORIGIN,
} from "../shared/constants/server.js";
import { AppError } from "../shared/errors/codes.js";
import type { ApiError } from "../shared/schemas/envelope.js";
import { generateNonce, verifyCapability } from "./security/index.js";
import { buildSecurityHeaders } from "./security/headers.js";
import type { ConfigService } from "./config/config-service.js";

export interface BuildAppOptions {
  capability: string;
  staticRoot?: string;
  workspaceRoot?: string;
  configService?: ConfigService;
  logger?: boolean | object;
}

function errorBody(error: AppError, requestId: string): ApiError {
  return {
    error: {
      code: error.code,
      message: error.message,
      ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}),
    },
    requestId,
  };
}

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const workspaceRoot = options.workspaceRoot ?? join(homedir(), ".local-notes");
  const app = Fastify({
    logger: options.logger ?? false,
    bodyLimit: BODY_LIMIT_BYTES,
    trustProxy: false,
    genReqId: () => randomUUID(),
    // MasterPrompt.md 7.1: static server never falls through to filesystem paths.
    ignoreTrailingSlash: false,
  });

  // Host check runs before routing; capability before any body parsing (ADR-003).
  app.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.headers.host !== LOCAL_HOST_HEADER) {
      throw new AppError("HOST_NOT_ALLOWED", "Request host is not the local application address.");
    }
    if (request.url.startsWith(API_PREFIX)) {
      const token = request.headers[CAPABILITY_HEADER];
      const value = Array.isArray(token) ? token[0] : token;
      if (!verifyCapability(value, options.capability)) {
        throw new AppError("LOCAL_ACCESS_REQUIRED", "Local access token missing or invalid.");
      }
      const method = request.method.toUpperCase();
      if (method !== "GET" && method !== "HEAD" && request.headers.origin !== LOCAL_ORIGIN) {
        throw new AppError("ORIGIN_NOT_ALLOWED", "Mutations require the local application origin.");
      }
    }
    reply.headers(buildSecurityHeaders(generateNonce()));
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.status).send(errorBody(error, request.id));
    }
    // Unknown errors: log stack locally, return generic message (7.3).
    request.log.error(error);
    return reply
      .status(500)
      .send(errorBody(new AppError("INTERNAL", "Unexpected local error."), request.id));
  });

  app.setNotFoundHandler((request, reply) => {
    reply
      .status(404)
      .send(errorBody(new AppError("NOT_FOUND", "Route not found."), request.id));
  });

  registerSystemRoutes(app, { workspaceRoot, configService: options.configService });

  if (options.staticRoot) {
    await app.register(fastifyStatic, {
      root: options.staticRoot,
      index: ["index.html"],
      dotfiles: "deny",
      list: false,
    });
  }

  return app;
}
