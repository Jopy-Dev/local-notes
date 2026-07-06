import type { EventBus } from "../events/event-bus.js";
import type { OperationRegistry } from "../events/operation-registry.js";
import type { MetadataCache } from "../filesystem/metadata-cache.js";
import type { NoteRepository } from "../filesystem/note-repository.js";
import { encodeNoteKey } from "../filesystem/path-guard.js";
import type { SearchService } from "../search/search-service.js";
import { correlateRenames } from "./rename-correlation.js";
import type { RenamePair } from "./rename-correlation.js";
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
    const previous = new Map(this.snapshot.map((note) => [note.relativePath, note]));
    this.snapshot = await this.deps.repository.scan(this.snapshot);
    await this.deps.cache.save(this.snapshot);
    const byPath = new Map(this.snapshot.map((note) => [note.relativePath, note]));
    const { renames, remainder } = correlateRenames(events, previous, byPath);
    for (const rename of renames) {
      await this.publishRename(rename);
    }
    for (const event of remainder) {
      await this.publish(event, byPath.get(event.relPath));
    }
  }

  /* REQ-018: a correlated rename collapses to one note.renamed event so the
   * open editor can follow the new key instead of seeing remove+add. */
  private async publishRename(pair: RenamePair): Promise<void> {
    const { bus, searchService, operationRegistry } = this.deps;
    const oldKey = encodeNoteKey(pair.oldPath);
    const noteKey = encodeNoteKey(pair.newPath);
    // Consume both registry entries - an app move registers source and target.
    const sourceId = operationRegistry.take(pair.oldPath);
    const targetId = operationRegistry.take(pair.newPath);
    const operationId = sourceId ?? targetId;
    await searchService.applyRemove(oldKey).catch(() => undefined);
    await searchService.applyUpsert(pair.note).catch(() => undefined);
    bus.publish({
      type: "note.renamed",
      oldKey,
      noteKey,
      version: pair.note.versionToken,
      ...(operationId ? { operationId } : {}),
    });
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
