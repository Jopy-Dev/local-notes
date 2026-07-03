import type { EventBus } from "../events/event-bus.js";
import type { OperationRegistry } from "../events/operation-registry.js";
import type { MetadataCache } from "../filesystem/metadata-cache.js";
import type { NoteRepository } from "../filesystem/note-repository.js";
import { encodeNoteKey } from "../filesystem/path-guard.js";
import type { SearchService } from "../search/search-service.js";
import type { WatchEvent } from "./workspace-watcher.js";
import type { NoteMetadata } from "../../shared/schemas/notes.js";

/*
 * Watch-event pipeline (MasterPrompt.md 4.2 + 4.5): owns the metadata
 * snapshot, rescans on each coalesced batch, feeds the search index, and
 * publishes SSE events. Self-originated events carry the mutation's
 * operation ID taken from the registry so the originating client never
 * treats its own write as a conflict. The watcher is the single SSE source.
 */
export interface WatchPipelineDeps {
  repository: NoteRepository;
  cache: MetadataCache;
  bus: EventBus;
  searchService: SearchService;
  operationRegistry: OperationRegistry;
}

export class WatchEventPipeline {
  private snapshot: NoteMetadata[];

  constructor(
    private readonly deps: WatchPipelineDeps,
    initialSnapshot: NoteMetadata[],
  ) {
    this.snapshot = initialSnapshot;
  }

  currentSnapshot(): readonly NoteMetadata[] {
    return this.snapshot;
  }

  async flush(): Promise<void> {
    await this.deps.cache.save(this.snapshot);
  }

  async handleBatch(events: WatchEvent[]): Promise<void> {
    this.snapshot = await this.deps.repository.scan(this.snapshot);
    await this.deps.cache.save(this.snapshot);
    const byPath = new Map(this.snapshot.map((note) => [note.relativePath, note]));
    for (const event of events) {
      await this.publish(event, byPath.get(event.relPath));
    }
  }

  private async publish(event: WatchEvent, note: NoteMetadata | undefined): Promise<void> {
    const { bus, searchService, operationRegistry } = this.deps;
    const noteKey = encodeNoteKey(event.relPath);
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
  }
}
