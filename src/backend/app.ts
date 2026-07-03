import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";
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
import { defaultConfig } from "../shared/schemas/config.js";
import type { BootstrapResponse } from "../shared/schemas/bootstrap.js";
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

  app.get(`${API_PREFIX}/health`, async (request) => {
    // Wave 0 slice: workspace/index services land Waves 1-3.
    return {
      data: { status: "ok", workspace: "pending", index: "unavailable" },
      requestId: request.id,
    };
  });

  app.get(`${API_PREFIX}/bootstrap`, async (request) => {
    // Persisted ConfigV1 when the service is wired (CLI path); defaults for
    // bare test apps. Index status stays a stub until Wave 3.
    const config = options.configService
      ? (await options.configService.load()).config
      : defaultConfig(workspaceRoot);
    const data: BootstrapResponse = {
      config,
      workspaceDisplayPath: config.workspace.replace(homedir(), "~"),
      indexStatus: "unavailable",
      appVersion: process.env.npm_package_version ?? "0.1.0",
    };
    return { data, requestId: request.id };
  });

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
