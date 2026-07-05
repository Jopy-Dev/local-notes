import { join } from "node:path";
import { EventBus } from "../backend/events/event-bus.js";
import { OperationRegistry } from "../backend/events/operation-registry.js";
import { MetadataCache } from "../backend/filesystem/metadata-cache.js";
import { NoteContentService } from "../backend/filesystem/note-content.js";
import { NoteMutationService } from "../backend/filesystem/note-mutations.js";
import { NoteRepository } from "../backend/filesystem/note-repository.js";
import type { WorkspacePathGuard } from "../backend/filesystem/path-guard.js";
import { createSearchService } from "../backend/search/create-search-service.js";
import type { SearchService } from "../backend/search/search-service.js";
import { WatchEventPipeline } from "../backend/watcher/watch-event-pipeline.js";
import { WorkspaceWatcher } from "../backend/watcher/workspace-watcher.js";

/*
 * CLI discovery stack (MasterPrompt.md 2.8 + 4.2 + 4.3 + 4.5): warm scan
 * from the disposable cache, search index build, then live watching through
 * the watch-event pipeline (SSE + index updates + self-event suppression).
 */
export interface DiscoveryStack {
  repository: NoteRepository;
  /* Archive tree access (round 2): listing + read-only content. */
  archiveRepository: NoteRepository;
  archiveContentService: NoteContentService;
  bus: EventBus;
  searchService: SearchService;
  mutationService: NoteMutationService;
  contentService: NoteContentService;
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
  const contentService = new NoteContentService(guard);
  const { service: searchService, engineKind } = createSearchService({
    guard,
    workspaceRoot,
    notesRelRoot: "save-data/notes",
    bus,
    notesFor: () => repository.scan(),
  });
  if (engineKind === "in-process") {
    console.warn("Search worker build not found - search runs in-process (run `npm run build:server`).");
  }

  const snapshot = await repository.scan((await cache.load()) ?? undefined);
  await cache.save(snapshot);
  // Warm index build: cached entries reconcile by versionToken (4.3). Search
  // stays non-blocking for the CLI - failures degrade search, never startup.
  await searchService.initialize(snapshot).catch(() => undefined);

  const pipeline = new WatchEventPipeline(
    { repository, cache, bus, searchService, operationRegistry },
    snapshot,
  );
  const watcher = new WorkspaceWatcher(await guard.resolve("save-data/notes"), {
    onBatch: (events) => void pipeline.handleBatch(events),
  });
  await watcher.ready();

  return {
    repository,
    archiveRepository: new NoteRepository(guard, "save-data/archive"),
    archiveContentService: new NoteContentService(guard, "save-data/archive"),
    bus,
    searchService,
    mutationService,
    contentService,
    operationRegistry,
    flush: () => pipeline.flush(),
    close: async () => {
      // Graceful order (1.5): watcher stops first, then caches flush.
      await watcher.close();
      await searchService.close().catch(() => undefined);
      await pipeline.flush().catch(() => undefined);
    },
  };
}
