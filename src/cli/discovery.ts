import { join } from "node:path";
import { EventBus } from "../backend/events/event-bus.js";
import { OperationRegistry } from "../backend/events/operation-registry.js";
import { MetadataCache } from "../backend/filesystem/metadata-cache.js";
import { NoteMutationService } from "../backend/filesystem/note-mutations.js";
import { NoteRepository } from "../backend/filesystem/note-repository.js";
import { encodeNoteKey } from "../backend/filesystem/path-guard.js";
import type { WorkspacePathGuard } from "../backend/filesystem/path-guard.js";
import { createSearchService } from "../backend/search/create-search-service.js";
import type { SearchService } from "../backend/search/search-service.js";
import { WorkspaceWatcher } from "../backend/watcher/workspace-watcher.js";
import type { WatchEvent } from "../backend/watcher/workspace-watcher.js";
import type { NoteMetadata } from "../shared/schemas/notes.js";

/*
 * CLI discovery stack (MasterPrompt.md 2.8 + 4.2 + 4.3): warm scan from the
 * disposable cache, live watching that republishes filesystem changes as SSE
 * events, and the search index fed from the same batch hook.
 */
export interface DiscoveryStack {
  repository: NoteRepository;
  bus: EventBus;
  searchService: SearchService;
  mutationService: NoteMutationService;
  operationRegistry: OperationRegistry;
  flush: () => Promise<void>;
  close: () => Promise<void>;
}

export async function startDiscovery(
  guard: WorkspacePathGuard,
  workspaceRoot: string,
): Promise<DiscoveryStack> {
  const repository = new NoteRepository(guard, "save-data/notes");
  const cache = new MetadataCache(join(workspaceRoot, "cache"));
  const bus = new EventBus();
  const operationRegistry = new OperationRegistry();
  const mutationService = new NoteMutationService(guard);
  const searchService = createSearchService({
    guard,
    workspaceRoot,
    notesRelRoot: "save-data/notes",
    bus,
  });

  let snapshot = await repository.scan((await cache.load()) ?? undefined);
  await cache.save(snapshot);
  // Warm index build: cached entries reconcile by versionToken (4.3). Search
  // stays non-blocking for the CLI - failures degrade search, never startup.
  await searchService.initialize(snapshot).catch(() => undefined);

  const publishEvent = async (event: WatchEvent, note: NoteMetadata | undefined) => {
    const noteKey = encodeNoteKey(event.relPath);
    // Self-originated events carry the mutation's operation ID (4.5) so
    // the originating client never treats its own write as a conflict.
    const operationId = operationRegistry.take(event.relPath);
    const tag = operationId ? { operationId } : {};
    if (event.kind === "removed") {
      await searchService.applyRemove(noteKey).catch(() => undefined);
      bus.publish({ type: "note.removed", noteKey, ...tag });
      return;
    }
    if (note) await searchService.applyUpsert(note).catch(() => undefined);
    const version = note?.versionToken ?? "";
    const type = event.kind === "added" ? ("note.added" as const) : ("note.changed" as const);
    bus.publish({ type, noteKey, version, ...tag });
  };

  const publishBatch = async (events: WatchEvent[]) => {
    snapshot = await repository.scan(snapshot);
    await cache.save(snapshot);
    const byPath = new Map(snapshot.map((note) => [note.relativePath, note]));
    for (const event of events) await publishEvent(event, byPath.get(event.relPath));
  };

  const watcher = new WorkspaceWatcher(await guard.resolve("save-data/notes"), {
    onBatch: (events) => void publishBatch(events),
  });
  await watcher.ready();

  return {
    repository,
    bus,
    searchService,
    mutationService,
    operationRegistry,
    flush: () => cache.save(snapshot),
    close: async () => {
      // Graceful order (1.5): watcher stops first, then caches flush.
      await watcher.close();
      await searchService.close().catch(() => undefined);
      await cache.save(snapshot).catch(() => undefined);
    },
  };
}
