import type { NoteMetadata } from "../../shared/schemas/notes.js";
import type { SearchResponse } from "../../shared/schemas/search.js";
import type { CachedIndexEntry } from "./search-index-cache.js";
import type { RebuildEntry } from "./search-index.js";

/*
 * Search worker message protocol (MasterPrompt.md 4.3): fixed request union,
 * every request carries a requestId, every response is success or typed
 * error. Structured-clone-safe plain objects only - both ends are this
 * codebase, so the boundary trusts types without runtime validation.
 */
export interface EngineCounts {
  indexedNotes: number;
  metadataOnlyNotes: number;
}

export type WorkerRequest =
  | { type: "INIT"; requestId: number; entries: RebuildEntry[] }
  | {
      type: "UPSERT";
      requestId: number;
      metadata: NoteMetadata;
      content: string | null;
      truncated: boolean;
    }
  | { type: "REMOVE"; requestId: number; noteKey: string }
  | { type: "SEARCH"; requestId: number; query: string; offset: number }
  | { type: "REBUILD"; requestId: number; entries: RebuildEntry[] }
  | { type: "SAVE"; requestId: number }
  | { type: "STATUS"; requestId: number }
  | { type: "SHUTDOWN"; requestId: number };

export type WorkerRequestType = WorkerRequest["type"];

export type WorkerSuccess =
  | { type: "INIT"; requestId: number; ok: true; counts: EngineCounts }
  | {
      type: "UPSERT";
      requestId: number;
      ok: true;
      counts: EngineCounts;
      rebalanceCandidates: NoteMetadata[];
    }
  | {
      type: "REMOVE";
      requestId: number;
      ok: true;
      counts: EngineCounts;
      rebalanceCandidates: NoteMetadata[];
    }
  | { type: "SEARCH"; requestId: number; ok: true; page: SearchResponse }
  | { type: "REBUILD"; requestId: number; ok: true; counts: EngineCounts }
  | { type: "SAVE"; requestId: number; ok: true; entries: CachedIndexEntry[] }
  | { type: "STATUS"; requestId: number; ok: true; counts: EngineCounts }
  | { type: "SHUTDOWN"; requestId: number; ok: true };

export interface WorkerFailure {
  type: WorkerRequestType;
  requestId: number;
  ok: false;
  error: string;
}

export type WorkerResponse = WorkerSuccess | WorkerFailure;
