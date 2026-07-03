import type { NoteMetadata } from "../../shared/schemas/notes.js";
import type { IndexStatus, SearchResponse } from "../../shared/schemas/search.js";
import { AppError } from "../../shared/errors/codes.js";
import type { EventBus } from "../events/event-bus.js";
import { IndexCheckpointer } from "./index-checkpointer.js";
import type { IndexableContent } from "./search-content.js";
import type { CachedIndexEntry } from "./search-index-cache.js";
import { SearchIndex } from "./search-index.js";
import type { IndexState } from "../../shared/schemas/search.js";

/*
 * Search service (MasterPrompt.md 4.3): status lifecycle unavailable ->
 * building -> ready/degraded, single-flight rebuild, incremental upsert with
 * budget rebalance, and dirty-index checkpoints (30s idle, at most once per
 * 5min, forced on close). Engine failure degrades search; editing never
 * depends on this service.
 */
const IDLE_SAVE_MS = 30_000;
const MIN_SAVE_INTERVAL_MS = 5 * 60_000;

export interface SearchCachePort {
  load(): Promise<CachedIndexEntry[] | null>;
  save(entries: readonly CachedIndexEntry[]): Promise<void>;
}

export interface SearchServiceOptions {
  contentFor: (note: NoteMetadata) => Promise<IndexableContent>;
  index?: SearchIndex;
  bus?: EventBus;
  cache?: SearchCachePort;
  idleSaveMs?: number;
  minSaveIntervalMs?: number;
}

export class SearchService {
  private readonly index: SearchIndex;
  private readonly bus: EventBus | undefined;
  private readonly contentFor: SearchServiceOptions["contentFor"];
  private readonly checkpointer: IndexCheckpointer;

  private state: IndexState = "unavailable";
  private rebuilding = false;

  constructor(options: SearchServiceOptions) {
    this.index = options.index ?? new SearchIndex();
    this.bus = options.bus;
    this.contentFor = options.contentFor;
    const cache = options.cache;
    this.cacheLoad = () => cache?.load() ?? Promise.resolve(null);
    this.checkpointer = new IndexCheckpointer(
      async () => {
        await cache?.save(this.snapshotEntries());
      },
      options.idleSaveMs ?? IDLE_SAVE_MS,
      options.minSaveIntervalMs ?? MIN_SAVE_INTERVAL_MS,
    );
  }

  private readonly cacheLoad: () => Promise<CachedIndexEntry[] | null>;

  status(): IndexStatus {
    const { indexedNotes, metadataOnlyNotes } = this.index.status();
    return { state: this.state, indexedNotes, metadataOnlyNotes };
  }

  get isRebuilding(): boolean {
    return this.rebuilding;
  }

  /*
   * Startup reconciliation (4.3): cached entries with a matching versionToken
   * reuse their indexed content; changed or new notes are re-read from disk.
   */
  async initialize(notes: readonly NoteMetadata[]): Promise<void> {
    this.setState("building");
    const cached = new Map(
      ((await this.cacheLoad()) ?? []).map((entry) => [entry.metadata.noteKey, entry]),
    );
    const entries = await Promise.all(
      notes.map(async (note) => {
        const warm = cached.get(note.noteKey);
        if (warm && warm.metadata.versionToken === note.versionToken) {
          return {
            metadata: note,
            content: warm.contentIndexStatus === "full" ? warm.content : null,
            truncated: warm.truncated,
          };
        }
        const read = await this.contentFor(note);
        return { metadata: note, content: read.content, truncated: read.truncated };
      }),
    );
    this.index.rebuild(entries);
    this.setState("ready");
  }

  async search(query: string, offset: number): Promise<SearchResponse> {
    if (this.state === "degraded" || this.state === "unavailable") {
      throw new AppError("SEARCH_DEGRADED", "Search index is unavailable. Rebuild to recover.");
    }
    try {
      return this.index.page(query, offset);
    } catch {
      this.setState("degraded");
      throw new AppError("SEARCH_DEGRADED", "Search index is unavailable. Rebuild to recover.");
    }
  }

  async rebuild(notes: readonly NoteMetadata[]): Promise<void> {
    if (this.rebuilding) {
      throw new AppError("REBUILD_RUNNING", "A search index rebuild is already running.");
    }
    this.rebuilding = true;
    this.setState("building");
    try {
      const entries = await Promise.all(
        notes.map(async (note) => {
          const read = await this.contentFor(note);
          return { metadata: note, content: read.content, truncated: read.truncated };
        }),
      );
      this.index.rebuild(entries);
      this.setState("ready");
      this.checkpointer.markDirty();
    } catch (error) {
      this.setState("degraded");
      throw error;
    } finally {
      this.rebuilding = false;
    }
  }

  async applyUpsert(note: NoteMetadata): Promise<void> {
    const read = await this.contentFor(note);
    this.index.upsert(note, read.content, read.truncated);
    await this.rebalance();
    this.checkpointer.markDirty();
  }

  async applyRemove(noteKey: string): Promise<void> {
    this.index.remove(noteKey);
    await this.rebalance();
    this.checkpointer.markDirty();
  }

  snapshotEntries(): CachedIndexEntry[] {
    return this.index.entries().map((entry) => ({
      metadata: entry.metadata,
      content: entry.contentIndexStatus === "full" ? entry.content : null,
      contentIndexStatus: entry.contentIndexStatus,
      truncated: entry.truncated,
    }));
  }

  async close(): Promise<void> {
    await this.checkpointer.close();
  }

  /* Freed budget refills smallest-first (REQ-010 rebalance). */
  private async rebalance(): Promise<void> {
    for (const noteKey of this.index.rebalanceCandidates()) {
      const entry = this.index.get(noteKey);
      if (!entry) continue;
      const read = await this.contentFor(entry.metadata);
      this.index.upsert(entry.metadata, read.content, read.truncated);
    }
  }

  private setState(state: IndexState): void {
    if (this.state === state) return;
    this.state = state;
    this.bus?.publish({ type: "index.status", status: state });
  }
}
