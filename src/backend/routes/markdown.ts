import type { FastifyInstance } from "fastify";
import { API_PREFIX } from "../../shared/constants/server.js";
import { AppError } from "../../shared/errors/codes.js";
import type { MarkdownRenderService } from "../markdown/render-service.js";

/*
 * Markdown routes (MasterPrompt.md 5.2, REQ-028): POST /markdown/render takes
 * the raw draft as text/plain with the note key in X-Note-Key so relative
 * links/images resolve against the note's folder; GET /assets serves guarded
 * raster bytes with sniffing and caching disabled (4.6).
 */
function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function registerMarkdownRoutes(
  app: FastifyInstance,
  options: { markdownService: MarkdownRenderService },
): void {
  app.post(`${API_PREFIX}/markdown/render`, async (request) => {
    const noteKey = headerValue(request.headers["x-note-key"]);
    if (!noteKey) {
      throw new AppError("INVALID_MARKDOWN", "Render requests need a valid X-Note-Key.");
    }
    const source = typeof request.body === "string" ? request.body : "";
    return { data: options.markdownService.render(source, noteKey), requestId: request.id };
  });

  app.get(`${API_PREFIX}/assets/:assetKey`, async (request, reply) => {
    const { assetKey } = request.params as { assetKey: string };
    const asset = await options.markdownService.readAsset(assetKey);
    return reply
      .header("content-type", asset.mime)
      .header("x-content-type-options", "nosniff")
      .header("cache-control", "no-store")
      .header("content-disposition", "inline")
      .send(asset.bytes);
  });
}
