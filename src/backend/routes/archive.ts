import type { FastifyInstance } from "fastify";
import { API_PREFIX } from "../../shared/constants/server.js";
import { AppError } from "../../shared/errors/codes.js";
import { restoreNoteSchema } from "../../shared/schemas/mutations.js";
import type { OperationRegistry } from "../events/operation-registry.js";
import type { NoteContentService } from "../filesystem/note-content.js";
import type { NoteMutationService } from "../filesystem/note-mutations.js";
import type { SearchService } from "../search/search-service.js";

/*
 * Archive routes (round 2, SCREEN-008): read-only content for archived
 * notes, restore into an active folder, and delete to the OS recycle bin
 * (ADR-009). Keys are archive-root-relative; the active-note routes never
 * accept them. Archived content has no save pipeline - GET only.
 */
export interface ArchiveRouteOptions {
  archiveContentService: NoteContentService;
  mutationService: NoteMutationService;
  searchService?: SearchService | undefined;
  operationRegistry?: OperationRegistry | undefined;
}

export function registerArchiveRoutes(app: FastifyInstance, options: ArchiveRouteOptions): void {
  app.get(`${API_PREFIX}/archive/:noteKey`, async (request) => {
    const { noteKey } = request.params as { noteKey: string };
    const document = await options.archiveContentService.read(noteKey);
    return { data: document, requestId: request.id };
  });

  app.post(`${API_PREFIX}/archive/:noteKey/restore`, async (request) => {
    const { noteKey } = request.params as { noteKey: string };
    const parsed = restoreNoteSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError("INVALID_QUERY", "Invalid restore payload.");
    }
    const metadata = await options.mutationService.restore(noteKey, parsed.data.destinationFolderKey);
    // The restored file appears in the watched active tree; tag the add so
    // the watcher SSE carries the operation ID (4.5), and index it now.
    options.operationRegistry?.register(metadata.relativePath, parsed.data.operationId);
    await options.searchService?.applyUpsert(metadata).catch(() => undefined);
    return { data: metadata, requestId: request.id };
  });

  app.delete(`${API_PREFIX}/archive/:noteKey`, async (request) => {
    const { noteKey } = request.params as { noteKey: string };
    await options.mutationService.deleteArchived(noteKey);
    return { data: { deleted: true }, requestId: request.id };
  });
}
