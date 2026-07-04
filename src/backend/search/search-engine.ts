import type { NoteMetadata } from "../../shared/schemas/notes.js";
import type { SearchResponse } from "../../shared/schemas/search.js";
import type { EngineCounts } from "./worker-protocol.js";
import type { CachedIndexEntry } from "./search-index-cache.js";
import { SearchIndex } from "./search-index.js";
import type { RebuildEntry } from "./search-index.js";

/*
 * Engine port behind SearchService (MasterPrompt.md 4.3). The packaged app
 * runs the worker-thread engine (worker-engine.ts); tests and a dev tree
 * without a dist build run this in-process adapter over the same SearchIndex.
 * Content reads and cache persistence stay main-thread in SearchService.
 */
export interface EngineMutationOutcome {
  counts: EngineCounts;
  rebalanceCandidates: NoteMetadata[];
}

export interface SearchEnginePort {
  init(entries: RebuildEntry[]): Promise<EngineCounts>;
  rebuild(entries: RebuildEntry[]): Promise<EngineCounts>;
  upsert(
    metadata: NoteMetadata,
    content: string | null,
    truncated: boolean,
  ): Promise<EngineMutationOutcome>;
  remove(noteKey: string): Promise<EngineMutationOutcome>;
  page(query: string, offset: number): Promise<SearchResponse>;
  snapshot(): Promise<CachedIndexEntry[]>;
  status(): Promise<EngineCounts>;
  /* Fires on unexpected engine death (never on close()). */
  onCrash(handler: () => void): void;
  /* Respawns a dead engine; no-op while running or after close(). */
  ensureRunning(): Promise<void>;
  close(): Promise<void>;
}

export function snapshotIndexEntries(index: SearchIndex): CachedIndexEntry[] {
  return index.entries().map((entry) => ({
    metadata: entry.metadata,
    content: entry.contentIndexStatus === "full" ? entry.content : null,
    contentIndexStatus: entry.contentIndexStatus,
    truncated: entry.truncated,
  }));
}

export function collectRebalanceCandidates(index: SearchIndex): NoteMetadata[] {
  return index.rebalanceCandidates().flatMap((noteKey) => {
    const entry = index.get(noteKey);
    return entry ? [entry.metadata] : [];
  });
}

export class InProcessSearchEngine implements SearchEnginePort {
  constructor(private readonly index: SearchIndex = new SearchIndex()) {}

  async init(entries: RebuildEntry[]): Promise<EngineCounts> {
    return this.rebuild(entries);
  }

  async rebuild(entries: RebuildEntry[]): Promise<EngineCounts> {
    this.index.rebuild(entries);
    return this.index.status();
  }

  async upsert(
    metadata: NoteMetadata,
    content: string | null,
    truncated: boolean,
  ): Promise<EngineMutationOutcome> {
    this.index.upsert(metadata, content, truncated);
    return { counts: this.index.status(), rebalanceCandidates: collectRebalanceCandidates(this.index) };
  }

  async remove(noteKey: string): Promise<EngineMutationOutcome> {
    this.index.remove(noteKey);
    return { counts: this.index.status(), rebalanceCandidates: collectRebalanceCandidates(this.index) };
  }

  async page(query: string, offset: number): Promise<SearchResponse> {
    return this.index.page(query, offset);
  }

  async snapshot(): Promise<CachedIndexEntry[]> {
    return snapshotIndexEntries(this.index);
  }

  async status(): Promise<EngineCounts> {
    return this.index.status();
  }

  onCrash(): void {
    // In-process engine cannot crash independently of the host process.
  }

  async ensureRunning(): Promise<void> {}

  async close(): Promise<void> {}
}
