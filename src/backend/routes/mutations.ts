import type { FastifyInstance } from "fastify";
import { API_PREFIX } from "../../shared/constants/server.js";
import { AppError } from "../../shared/errors/codes.js";
import { archiveNoteSchema, createNoteSchema, moveNoteSchema } from "../../shared/schemas/mutations.js";
import type { OperationRegistry } from "../events/operation-registry.js";
import { decodeNoteKey } from "../filesystem/path-guard.js";
import type { NoteMutationService } from "../filesystem/note-mutations.js";
import type { SearchService } from "../search/search-service.js";
import type { ZodType } from "zod";

/*
 * Mutation routes (MasterPrompt.md 5.2, WF-003/008/009). Move/archive
 * register their operation ID per touched path BEFORE the filesystem change
 * so the watcher tags the resulting SSE events (4.5). The watcher remains the
 * single SSE source - routes never publish note events directly.
 */
export interface MutationRouteOptions {
  mutationService: NoteMutationService;
  searchService?: SearchService | undefined;
  operationRegistry?: OperationRegistry | undefined;
}

function parseBody<T>(schema: ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("INVALID_QUERY", "Invalid mutation payload.");
  }
  return parsed.data;
}

export function registerMutationRoutes(app: FastifyInstance, options: MutationRouteOptions): void {
  const { mutationService, searchService, operationRegistry } = options;

  app.post(`${API_PREFIX}/notes`, async (request) => {
    const input = parseBody(createNoteSchema, request.body);
    const metadata = await mutationService.create(input);
    await searchService?.applyUpsert(metadata).catch(() => undefined);
    return { data: metadata, requestId: request.id };
  });

  app.post(`${API_PREFIX}/notes/:noteKey/move`, async (request) => {
    const { noteKey } = request.params as { noteKey: string };
    const input = parseBody(moveNoteSchema, request.body);
    const sourceRel = decodeNoteKey(noteKey);
    // Register both sides: rename surfaces as unlink(source) + add(dest).
    operationRegistry?.register(sourceRel, input.operationId);
    const metadata = await mutationService.move(noteKey, input.destinationFolderKey);
    operationRegistry?.register(metadata.relativePath, input.operationId);
    await searchService?.applyRemove(noteKey).catch(() => undefined);
    await searchService?.applyUpsert(metadata).catch(() => undefined);
    return { data: metadata, requestId: request.id };
  });

  app.post(`${API_PREFIX}/notes/:noteKey/archive`, async (request) => {
    const { noteKey } = request.params as { noteKey: string };
    const input = parseBody(archiveNoteSchema, request.body);
    const sourceRel = decodeNoteKey(noteKey);
    operationRegistry?.register(sourceRel, input.operationId);
    const result = await mutationService.archive(noteKey, input.replacementFilename);
    await searchService?.applyRemove(noteKey).catch(() => undefined);
    return { data: result, requestId: request.id };
  });
}
