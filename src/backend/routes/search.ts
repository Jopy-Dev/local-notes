import type { FastifyInstance } from "fastify";
import { API_PREFIX } from "../../shared/constants/server.js";
import { AppError } from "../../shared/errors/codes.js";
import { searchQuerySchema } from "../../shared/schemas/search.js";
import type { NoteRepository } from "../filesystem/note-repository.js";
import type { SearchService } from "../search/search-service.js";

/*
 * Search routes (MasterPrompt.md 5.2, WF-002/011): ranked batches of 200 and
 * a fire-and-forget rebuild. Degraded index maps to 503 SEARCH_DEGRADED via
 * the shared error taxonomy; editing never depends on these routes.
 */
export function registerSearchRoutes(
  app: FastifyInstance,
  options: { searchService: SearchService; repository: NoteRepository },
): void {
  // Synchronous reservation closes the scan-vs-rebuild race window; the
  // service enforces single-flight for callers that bypass this route.
  let rebuildBusy = false;

  app.get(`${API_PREFIX}/search`, async (request) => {
    const parsed = searchQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      throw new AppError("INVALID_QUERY", "Invalid search query parameters.");
    }
    const { q, offset } = parsed.data;
    return { data: await options.searchService.search(q, offset), requestId: request.id };
  });

  app.post(`${API_PREFIX}/search/rebuild`, async (request) => {
    if (rebuildBusy || options.searchService.isRebuilding) {
      throw new AppError("REBUILD_RUNNING", "A search index rebuild is already running.");
    }
    rebuildBusy = true;
    void (async () => {
      try {
        const notes = await options.repository.scan();
        await options.searchService.rebuild(notes);
      } catch {
        // Failure surfaces through index.status SSE + degraded search state.
      } finally {
        rebuildBusy = false;
      }
    })();
    return { data: { accepted: true }, requestId: request.id };
  });
}
