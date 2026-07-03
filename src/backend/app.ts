import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import { BODY_LIMIT_BYTES } from "../shared/constants/server.js";
import type { ConfigService } from "./config/config-service.js";
import { registerErrorHandling } from "./error-handling.js";
import { registerEventsRoute } from "./routes/events.js";
import { registerNotesRoutes } from "./routes/notes.js";
import { registerSearchRoutes } from "./routes/search.js";
import { registerSystemRoutes } from "./routes/system.js";
import type { EventBus } from "./events/event-bus.js";
import { registerBoundary } from "./security/boundary.js";
import type { NoteRepository } from "./filesystem/note-repository.js";
import type { SearchService } from "./search/search-service.js";

/*
 * App composer: boundary hook -> error handling -> route modules -> static
 * SPA. Behavior contracts live in security/boundary.ts, error-handling.ts,
 * and routes/* - this file only assembles them.
 */
export interface BuildAppOptions {
  capability: string;
  staticRoot?: string;
  workspaceRoot?: string;
  configService?: ConfigService;
  noteRepository?: NoteRepository;
  eventBus?: EventBus;
  searchService?: SearchService;
  logger?: boolean | object;
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

  registerBoundary(app, options.capability);
  registerErrorHandling(app);
  registerSystemRoutes(app, {
    workspaceRoot,
    configService: options.configService,
    indexState: options.searchService ? () => options.searchService!.status().state : undefined,
  });
  if (options.noteRepository) {
    registerNotesRoutes(app, { repository: options.noteRepository });
  }
  if (options.eventBus) {
    registerEventsRoute(app, { bus: options.eventBus });
  }
  if (options.searchService && options.noteRepository) {
    registerSearchRoutes(app, {
      searchService: options.searchService,
      repository: options.noteRepository,
    });
  }

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
