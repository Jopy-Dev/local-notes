import { homedir } from "node:os";
import type { FastifyInstance } from "fastify";
import { API_PREFIX } from "../../shared/constants/server.js";
import { defaultConfig } from "../../shared/schemas/config.js";
import type { BootstrapResponse } from "../../shared/schemas/bootstrap.js";
import type { ConfigService } from "../config/config-service.js";

/*
 * System routes: /health + /bootstrap (MasterPrompt.md 5.2). Workspace/index
 * status fields stay stubs until Waves 2-3 wire repository + search worker.
 */
export interface SystemRouteOptions {
  workspaceRoot: string;
  configService?: ConfigService | undefined;
  indexState?: (() => "unavailable" | "building" | "ready" | "degraded") | undefined;
}

export function registerSystemRoutes(app: FastifyInstance, options: SystemRouteOptions): void {
  const indexState = options.indexState ?? (() => "unavailable" as const);

  app.get(`${API_PREFIX}/health`, async (request) => {
    return {
      data: { status: "ok", workspace: "pending", index: indexState() },
      requestId: request.id,
    };
  });

  app.get(`${API_PREFIX}/bootstrap`, async (request) => {
    const config = options.configService
      ? (await options.configService.load()).config
      : defaultConfig(options.workspaceRoot);
    const data: BootstrapResponse = {
      config,
      workspaceDisplayPath: config.workspace.replace(homedir(), "~"),
      indexStatus: indexState(),
      appVersion: process.env.npm_package_version ?? "0.1.0",
    };
    return { data, requestId: request.id };
  });
}
