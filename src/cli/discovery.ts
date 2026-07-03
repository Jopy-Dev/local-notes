import { join } from "node:path";
import { EventBus } from "../backend/events/event-bus.js";
import { MetadataCache } from "../backend/filesystem/metadata-cache.js";
import { NoteRepository } from "../backend/filesystem/note-repository.js";
import { encodeNoteKey } from "../backend/filesystem/path-guard.js";
import type { WorkspacePathGuard } from "../backend/filesystem/path-guard.js";
import { WorkspaceWatcher } from "../backend/watcher/workspace-watcher.js";
import type { WatchEvent } from "../backend/watcher/workspace-watcher.js";

/*
 * CLI discovery stack (MasterPrompt.md 2.8 + 4.2): warm scan from the
 * disposable cache, then live watching that republishes filesystem changes
 * as SSE events and keeps cache + snapshot current. Search worker joins at
 * Wave 3 via the same batch hook.
 */
export interface DiscoveryStack {
  repository: NoteRepository;
  bus: EventBus;
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

  let snapshot = await repository.scan((await cache.load()) ?? undefined);
  await cache.save(snapshot);

  const publishBatch = async (events: WatchEvent[]) => {
    snapshot = await repository.scan(snapshot);
    await cache.save(snapshot);
    const byPath = new Map(snapshot.map((note) => [note.relativePath, note]));
    for (const event of events) {
      const noteKey = encodeNoteKey(event.relPath);
      const version = byPath.get(event.relPath)?.versionToken ?? "";
      if (event.kind === "removed") bus.publish({ type: "note.removed", noteKey });
      else if (event.kind === "added") bus.publish({ type: "note.added", noteKey, version });
      else bus.publish({ type: "note.changed", noteKey, version });
    }
  };

  const watcher = new WorkspaceWatcher(await guard.resolve("save-data/notes"), {
    onBatch: (events) => void publishBatch(events),
  });
  await watcher.ready();

  return {
    repository,
    bus,
    flush: () => cache.save(snapshot),
    close: async () => {
      await watcher.close();
      await cache.save(snapshot).catch(() => undefined);
    },
  };
}
