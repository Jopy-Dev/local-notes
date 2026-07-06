import type { FastifyInstance } from "fastify";
import { API_PREFIX } from "../../shared/constants/server.js";
import { AppError } from "../../shared/errors/codes.js";
import type { OperationRegistry } from "../events/operation-registry.js";
import { decodeNoteKey } from "../filesystem/path-guard.js";
import type { NoteContentService } from "../filesystem/note-content.js";
import type { SearchService } from "../search/search-service.js";

/*
 * Note content routes (MasterPrompt.md 5.2, WF-005/006): GET returns the
 * NoteDocument; PUT takes the raw text draft with the expected version in
 * If-Match and the client operation ID in X-Operation-ID so the watcher's
 * echo of our own write never surfaces as a conflict (4.5).
 */
const VERSION_TOKEN = /^[a-f0-9]{64}$/;
const OPERATION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function registerContentRoutes(
  app: FastifyInstance,
  options: {
    contentService: NoteContentService;
    searchService?: SearchService | undefined;
    operationRegistry?: OperationRegistry | undefined;
  },
): void {
  app.get(`${API_PREFIX}/notes/:noteKey`, async (request) => {
    const { noteKey } = request.params as { noteKey: string };
    return { data: await options.contentService.read(noteKey), requestId: request.id };
  });

  app.put(`${API_PREFIX}/notes/:noteKey/content`, async (request) => {
    const { noteKey } = request.params as { noteKey: string };
    const expectedVersion = headerValue(request.headers["if-match"]);
    if (!expectedVersion || !VERSION_TOKEN.test(expectedVersion)) {
      throw new AppError("INVALID_QUERY", "Content saves require the loaded version in If-Match.");
    }
    const operationId = headerValue(request.headers["x-operation-id"]);
    if (operationId && OPERATION_ID.test(operationId)) {
      options.operationRegistry?.register(decodeNoteKey(noteKey), operationId);
    }
    const draft = typeof request.body === "string" ? request.body : "";
    const metadata = await options.contentService.write(noteKey, draft, expectedVersion);
    await options.searchService?.applyUpsert(metadata).catch(() => undefined);
    return { data: metadata, requestId: request.id };
  });
}
