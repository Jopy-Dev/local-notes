import { join } from "node:path";
import { EventBus } from "../backend/events/event-bus.js";
import { MetadataCache } from "../backend/filesystem/metadata-cache.js";
import { NoteRepository } from "../backend/filesystem/note-repository.js";
import { encodeNoteKey } from "../backend/filesystem/path-guard.js";
import type { WorkspacePathGuard } from "../backend/filesystem/path-guard.js";
import { createSearchService } from "../backend/search/create-search-service.js";
import type { SearchService } from "../backend/search/search-service.js";
import { WorkspaceWatcher } from "../backend/watcher/workspace-watcher.js";
import type { WatchEvent } from "../backend/watcher/workspace-watcher.js";

/*
 * CLI discovery stack (MasterPrompt.md 2.8 + 4.2 + 4.3): warm scan from the
 * disposable cache, live watching that republishes filesystem changes as SSE
 * events, and the search index fed from the same batch hook.
 */
export interface DiscoveryStack {
  repository: NoteRepository;
  bus: EventBus;
  searchService: SearchService;
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

  const publishBatch = async (events: WatchEvent[]) => {
    snapshot = await repository.scan(snapshot);
    await cache.save(snapshot);
    const byPath = new Map(snapshot.map((note) => [note.relativePath, note]));
    for (const event of events) {
      const noteKey = encodeNoteKey(event.relPath);
      const note = byPath.get(event.relPath);
      const version = note?.versionToken ?? "";
      if (event.kind === "removed") {
        await searchService.applyRemove(noteKey).catch(() => undefined);
        bus.publish({ type: "note.removed", noteKey });
      } else if (event.kind === "added") {
        if (note) await searchService.applyUpsert(note).catch(() => undefined);
        bus.publish({ type: "note.added", noteKey, version });
      } else {
        if (note) await searchService.applyUpsert(note).catch(() => undefined);
        bus.publish({ type: "note.changed", noteKey, version });
      }
    }
  };

  const watcher = new WorkspaceWatcher(await guard.resolve("save-data/notes"), {
    onBatch: (events) => void publishBatch(events),
  });
  await watcher.ready();

  return {
    repository,
    bus,
    searchService,
    flush: () => cache.save(snapshot),
    close: async () => {
      // Graceful order (1.5): watcher stops first, then caches flush.
      await watcher.close();
      await searchService.close().catch(() => undefined);
      await cache.save(snapshot).catch(() => undefined);
    },
  };
}
