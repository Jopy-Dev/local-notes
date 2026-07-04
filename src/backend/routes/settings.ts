import type { FastifyInstance } from "fastify";
import { API_PREFIX } from "../../shared/constants/server.js";
import { AppError } from "../../shared/errors/codes.js";
import { configUpdateSchema } from "../../shared/schemas/config.js";
import type { ConfigService } from "../config/config-service.js";
import type { EventBus } from "../events/event-bus.js";

/*
 * Settings routes (MasterPrompt.md 5.2, WF-010, REQ-021/022/034). PUT accepts
 * partial appearance/view/sort/pane fields; workspace and version are never
 * client-writable (schema strict + ConfigService double-guard). Every update
 * serializes through the config mutex and lands atomically; settings.changed
 * fans out over SSE so other tabs refresh.
 */
export interface SettingsRouteOptions {
  configService: ConfigService;
  bus?: EventBus | undefined;
}

export function registerSettingsRoutes(app: FastifyInstance, options: SettingsRouteOptions): void {
  app.get(`${API_PREFIX}/settings`, async (request) => {
    try {
      const { config } = await options.configService.load();
      return { data: config, requestId: request.id };
    } catch {
      throw new AppError("CONFIG_READ_FAILED", "The configuration file could not be read.");
    }
  });

  app.put(`${API_PREFIX}/settings`, async (request) => {
    const parsed = configUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0] ?? "settings");
        fieldErrors[field] = [...(fieldErrors[field] ?? []), issue.message];
      }
      throw new AppError("INVALID_SETTING", "One or more settings are invalid.", fieldErrors);
    }
    const config = await options.configService.update(parsed.data);
    options.bus?.publish({ type: "settings.changed" });
    return { data: config, requestId: request.id };
  });
}
