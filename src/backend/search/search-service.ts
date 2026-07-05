import type { NoteMetadata } from "../../shared/schemas/notes.js";
import type { IndexStatus, SearchResponse } from "../../shared/schemas/search.js";
import { AppError } from "../../shared/errors/codes.js";
import type { EventBus } from "../events/event-bus.js";
import { IndexCheckpointer } from "./index-checkpointer.js";
import { buildIndexEntries } from "./index-entries.js";
import type { IndexableContent } from "./search-content.js";
import { InProcessSearchEngine } from "./search-engine.js";
import type { SearchEnginePort } from "./search-engine.js";
import type { CachedIndexEntry } from "./search-index-cache.js";
import type { SearchIndex } from "./search-index.js";
import type { IndexState } from "../../shared/schemas/search.js";
import type { EngineCounts } from "./worker-protocol.js";

/*
 * Search service (MasterPrompt.md 4.3): status lifecycle unavailable ->
 * building -> ready/degraded, single-flight rebuild, incremental upsert with
 * budget rebalance, and dirty-index checkpoints (30s idle, at most once per
 * 5min, forced on close). The index engine sits behind SearchEnginePort -
 * worker thread in the packaged app, in-process otherwise. Engine crash
 * degrades search, restarts the worker once with an automatic rebuild, and
 * repeated crash waits for an explicit rebuild through the recovery screen.
 * Editing never depends on this service.
 */
const IDLE_SAVE_MS = 30_000;
const MIN_SAVE_INTERVAL_MS = 5 * 60_000;

export interface SearchCachePort {
  load(): Promise<CachedIndexEntry[] | null>;
  save(entries: readonly CachedIndexEntry[]): Promise<void>;
}

export interface SearchServiceOptions {
  contentFor: (note: NoteMetadata) => Promise<IndexableContent>;
  engine?: SearchEnginePort;
  index?: SearchIndex;
  bus?: EventBus;
  cache?: SearchCachePort;
  notesFor?: () => Promise<readonly NoteMetadata[]>;
  idleSaveMs?: number;
  minSaveIntervalMs?: number;
}

export class SearchService {
  private readonly engine: SearchEnginePort;
  private readonly bus: EventBus | undefined;
  private readonly contentFor: SearchServiceOptions["contentFor"];
  private readonly notesFor: SearchServiceOptions["notesFor"];
  private readonly checkpointer: IndexCheckpointer;

  private state: IndexState = "unavailable";
  private counts: EngineCounts = { indexedNotes: 0, metadataOnlyNotes: 0 };
  private rebuilding = false;
  private restartUsed = false;

  constructor(options: SearchServiceOptions) {
    this.engine = options.engine ?? new InProcessSearchEngine(options.index);
    this.bus = options.bus;
    this.contentFor = options.contentFor;
    this.notesFor = options.notesFor;
    this.engine.onCrash(() => void this.handleCrash());
    const cache = options.cache;
    this.cacheLoad = () => cache?.load() ?? Promise.resolve(null);
    this.checkpointer = new IndexCheckpointer(
      async () => {
        await cache?.save(await this.engine.snapshot());
      },
      options.idleSaveMs ?? IDLE_SAVE_MS,
      options.minSaveIntervalMs ?? MIN_SAVE_INTERVAL_MS,
    );
  }

  private readonly cacheLoad: () => Promise<CachedIndexEntry[] | null>;

  status(): IndexStatus {
    return { state: this.state, ...this.counts };
  }

  get isRebuilding(): boolean {
    return this.rebuilding;
  }

  /* Startup reconciliation (4.3) - warm-entry reuse in buildIndexEntries. */
  async initialize(notes: readonly NoteMetadata[]): Promise<void> {
    this.setState("building");
    const cached = new Map(
      ((await this.cacheLoad()) ?? []).map((entry) => [entry.metadata.noteKey, entry]),
    );
    this.counts = await this.engine.init(await buildIndexEntries(notes, this.contentFor, cached));
    this.setState("ready");
  }

  async search(query: string, offset: number): Promise<SearchResponse> {
    if (this.state === "degraded" || this.state === "unavailable") {
      throw new AppError("SEARCH_DEGRADED", "Search index is unavailable. Rebuild to recover.");
    }
    try {
      return await this.engine.page(query, offset);
    } catch {
      this.setState("degraded");
      throw new AppError("SEARCH_DEGRADED", "Search index is unavailable. Rebuild to recover.");
    }
  }

  /* Explicit rebuild (recovery screen / route) re-arms the restart budget. */
  async rebuild(notes: readonly NoteMetadata[]): Promise<void> {
    await this.runRebuild(notes);
    this.restartUsed = false;
  }

  async applyUpsert(note: NoteMetadata): Promise<void> {
    const read = await this.contentFor(note);
    const outcome = await this.engine.upsert(note, read.content, read.truncated);
    this.counts = outcome.counts;
    await this.rebalance(outcome.rebalanceCandidates);
    this.checkpointer.markDirty();
  }

  async applyRemove(noteKey: string): Promise<void> {
    const outcome = await this.engine.remove(noteKey);
    this.counts = outcome.counts;
    await this.rebalance(outcome.rebalanceCandidates);
    this.checkpointer.markDirty();
  }

  async close(): Promise<void> {
    await this.checkpointer.close();
    await this.engine.close();
  }

  private async runRebuild(notes: readonly NoteMetadata[]): Promise<void> {
    if (this.rebuilding) {
      throw new AppError("REBUILD_RUNNING", "A search index rebuild is already running.");
    }
    this.rebuilding = true;
    this.setState("building");
    try {
      await this.engine.ensureRunning();
      this.counts = await this.engine.rebuild(await buildIndexEntries(notes, this.contentFor));
      this.setState("ready");
      this.checkpointer.markDirty();
    } catch (error) {
      this.setState("degraded");
      throw error;
    } finally {
      this.rebuilding = false;
    }
  }

  /*
   * Worker crash policy (4.3): degrade, restart the worker once with an
   * automatic rebuild; a crash after the restart budget is spent stays
   * degraded until an explicit rebuild through the recovery screen.
   */
  private async handleCrash(): Promise<void> {
    this.setState("degraded");
    if (this.restartUsed || !this.notesFor) return;
    this.restartUsed = true;
    const notes = await this.notesFor().catch(() => null);
    if (!notes) return;
    await this.runRebuild(notes).catch(() => undefined);
  }

  /* Freed budget refills smallest-first (REQ-010 rebalance). */
  private async rebalance(candidates: readonly NoteMetadata[]): Promise<void> {
    for (const metadata of candidates) {
      const read = await this.contentFor(metadata);
      const outcome = await this.engine.upsert(metadata, read.content, read.truncated);
      this.counts = outcome.counts;
    }
  }

  private setState(state: IndexState): void {
    if (this.state === state) return;
    this.state = state;
    this.bus?.publish({ type: "index.status", status: state });
  }
}
