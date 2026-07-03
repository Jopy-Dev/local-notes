import { create, insert, remove as oramaRemove, search as oramaSearch } from "@orama/orama";
import type { Orama } from "@orama/orama";
import type { NoteMetadata } from "../../shared/schemas/notes.js";
import { CONTENT_BUDGET_BYTES, CONTENT_INDEX_CAP_BYTES, SEARCH_BATCH_SIZE } from "../../shared/schemas/search.js";
import type { ContentIndexStatus, SearchResponse, SearchResult } from "../../shared/schemas/search.js";
import { rankEntries } from "./search-ranking.js";
import { buildSnippet } from "./search-snippet.js";

/*
 * Orama-backed search engine (MasterPrompt.md 4.3). Owns the index, the
 * per-note registry used for ranking/snippets, and the 512 MiB aggregate
 * content-budget ledger (REQ-010): overflow notes stay metadata-only
 * searchable; freed budget rebalances smallest-first. Pure in-memory -
 * content reading, persistence, and status lifecycle live one layer up.
 */
const ORAMA_SCHEMA = {
  title: "string",
  filename: "string",
  content: "string",
} as const;

const MAX_CANDIDATES = 10_000;

export interface IndexedNote {
  metadata: NoteMetadata;
  content: string;
  contentIndexStatus: ContentIndexStatus;
  truncated: boolean;
}

export interface RankedEntry extends IndexedNote {
  score: number;
}

export interface RebuildEntry {
  metadata: NoteMetadata;
  content: string | null;
  truncated?: boolean;
}

type SearchDb = Orama<typeof ORAMA_SCHEMA>;

function toResult(entry: RankedEntry, query: string): SearchResult {
  const { snippet, matchRanges } = buildSnippet(entry.content, query);
  return {
    noteKey: entry.metadata.noteKey,
    title: entry.metadata.title,
    relativePath: entry.metadata.relativePath,
    folder: entry.metadata.folder,
    extension: entry.metadata.extension,
    modifiedAt: entry.metadata.modifiedAt,
    sizeBytes: entry.metadata.sizeBytes,
    snippet,
    matchRanges,
    contentIndexStatus: entry.contentIndexStatus,
    truncated: entry.truncated,
  };
}

export class SearchIndex {
  private db: SearchDb = create({ schema: ORAMA_SCHEMA });
  private readonly registry = new Map<string, IndexedNote>();
  private readonly allocations = new Map<string, number>();
  private allocatedBytes = 0;
  private readonly budgetBytes: number;

  constructor(options: { contentBudgetBytes?: number } = {}) {
    this.budgetBytes = options.contentBudgetBytes ?? CONTENT_BUDGET_BYTES;
  }

  upsert(metadata: NoteMetadata, content: string | null, truncated = false): void {
    this.removeFromDb(metadata.noteKey);
    this.releaseAllocation(metadata.noteKey);

    const wantBytes = content === null ? 0 : Buffer.byteLength(content, "utf8");
    const fits = content !== null && this.allocatedBytes + wantBytes <= this.budgetBytes;
    const indexedContent = fits ? (content ?? "") : "";
    if (fits) {
      this.allocations.set(metadata.noteKey, wantBytes);
      this.allocatedBytes += wantBytes;
    }
    this.registry.set(metadata.noteKey, {
      metadata,
      content: indexedContent,
      contentIndexStatus: fits ? "full" : "metadata-only",
      truncated,
    });
    insert(this.db, {
      id: metadata.noteKey,
      title: metadata.title,
      filename: metadata.filename,
      content: indexedContent,
    });
  }

  remove(noteKey: string): void {
    this.removeFromDb(noteKey);
    this.releaseAllocation(noteKey);
    this.registry.delete(noteKey);
  }

  /* Rebuild allocates smallest-first by sizeBytes then path (REQ-010). */
  rebuild(entries: RebuildEntry[]): void {
    this.db = create({ schema: ORAMA_SCHEMA });
    this.registry.clear();
    this.allocations.clear();
    this.allocatedBytes = 0;
    const ordered = [...entries].sort(
      (a, b) =>
        a.metadata.sizeBytes - b.metadata.sizeBytes ||
        a.metadata.relativePath.localeCompare(b.metadata.relativePath),
    );
    for (const entry of ordered) this.upsert(entry.metadata, entry.content, entry.truncated ?? false);
  }

  search(query: string): RankedEntry[] {
    const result = oramaSearch(this.db, {
      term: query,
      tolerance: 1,
      limit: MAX_CANDIDATES,
    });
    // Orama types search as sync-or-Promise; without async plugins it is
    // always sync. Guard keeps the engine API synchronous and type-safe.
    if (result instanceof Promise) throw new Error("Unexpected async Orama search result.");
    const candidates: RankedEntry[] = [];
    for (const hit of result.hits) {
      const entry = this.registry.get(String(hit.id));
      if (entry) candidates.push({ ...entry, score: hit.score });
    }
    return rankEntries(candidates, query);
  }

  page(query: string, offset: number): SearchResponse {
    const ranked = this.search(query);
    const results = ranked.slice(offset, offset + SEARCH_BATCH_SIZE).map((entry) => toResult(entry, query));
    return {
      results,
      total: ranked.length,
      hasMore: offset + SEARCH_BATCH_SIZE < ranked.length,
    };
  }

  get(noteKey: string): IndexedNote | undefined {
    return this.registry.get(noteKey);
  }

  entries(): IndexedNote[] {
    return [...this.registry.values()];
  }

  status(): { indexedNotes: number; metadataOnlyNotes: number } {
    let metadataOnly = 0;
    for (const entry of this.registry.values()) {
      if (entry.contentIndexStatus === "metadata-only") metadataOnly += 1;
    }
    return { indexedNotes: this.registry.size - metadataOnly, metadataOnlyNotes: metadataOnly };
  }

  /* Metadata-only notes that now fit freed budget, smallest-first. */
  rebalanceCandidates(): string[] {
    const remaining = this.budgetBytes - this.allocatedBytes;
    return [...this.registry.values()]
      .filter(
        (entry) =>
          entry.contentIndexStatus === "metadata-only" &&
          Math.min(entry.metadata.sizeBytes, CONTENT_INDEX_CAP_BYTES) <= remaining,
      )
      .sort(
        (a, b) =>
          a.metadata.sizeBytes - b.metadata.sizeBytes ||
          a.metadata.relativePath.localeCompare(b.metadata.relativePath),
      )
      .map((entry) => entry.metadata.noteKey);
  }

  private removeFromDb(noteKey: string): void {
    if (this.registry.has(noteKey)) oramaRemove(this.db, noteKey);
  }

  private releaseAllocation(noteKey: string): void {
    const previous = this.allocations.get(noteKey);
    if (previous !== undefined) {
      this.allocatedBytes -= previous;
      this.allocations.delete(noteKey);
    }
  }
}
