import { create } from "zustand";
import { ApiRequestError } from "../services/api";
import { fetchSearchPage, requestRebuild } from "../services/searchApi";
import { SEARCH_BATCH_SIZE } from "../../shared/schemas/search.js";
import type { IndexState, SearchResult } from "../../shared/schemas/search.js";

/*
 * Ranked search state (WF-002/011): stale requests abort on retype, batches
 * of 200 append while preserving query and selection, degraded index routes
 * to the recovery surface. Index state seeds from bootstrap and follows SSE
 * index.status events.
 */
export type SearchStatus = "idle" | "searching" | "ready" | "error";

interface SearchDataState {
  query: string;
  status: SearchStatus;
  results: SearchResult[];
  total: number;
  hasMore: boolean;
  indexState: IndexState;
  rebuildRequested: boolean;
  run: (query: string) => Promise<void>;
  loadMore: () => Promise<void>;
  clear: () => void;
  setIndexState: (state: IndexState) => void;
  startRebuild: () => Promise<void>;
}

let inFlight: AbortController | null = null;

export const useSearchData = create<SearchDataState>((set, get) => ({
  query: "",
  status: "idle",
  results: [],
  total: 0,
  hasMore: false,
  indexState: "unavailable",
  rebuildRequested: false,

  run: async (query) => {
    inFlight?.abort();
    const controller = new AbortController();
    inFlight = controller;
    set({ query, status: "searching" });
    try {
      const page = await fetchSearchPage({ q: query, signal: controller.signal });
      if (controller.signal.aborted) return;
      set({ results: page.results, total: page.total, hasMore: page.hasMore, status: "ready" });
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error instanceof ApiRequestError && error.code === "SEARCH_DEGRADED") {
        set({ indexState: "degraded", status: "error", results: [], total: 0, hasMore: false });
      } else {
        set({ status: "error", results: [], total: 0, hasMore: false });
      }
    }
  },

  loadMore: async () => {
    const { query, results, hasMore } = get();
    if (!hasMore || !query) return;
    const offset = Math.floor(results.length / SEARCH_BATCH_SIZE) * SEARCH_BATCH_SIZE;
    const page = await fetchSearchPage({ q: query, offset });
    // Append preserves selection and scroll (WF-002); dedupe by key.
    const seen = new Set(results.map((entry) => entry.noteKey));
    const appended = page.results.filter((entry) => !seen.has(entry.noteKey));
    set({ results: [...results, ...appended], total: page.total, hasMore: page.hasMore });
  },

  clear: () => {
    inFlight?.abort();
    set({ query: "", status: "idle", results: [], total: 0, hasMore: false });
  },

  setIndexState: (state) => {
    set((current) => ({
      indexState: state,
      // ready after a rebuild clears the one-shot request latch (WF-011)
      rebuildRequested: current.rebuildRequested && state === "building",
    }));
  },

  startRebuild: async () => {
    set({ rebuildRequested: true });
    try {
      await requestRebuild();
    } catch (error) {
      if (!(error instanceof ApiRequestError && error.code === "REBUILD_RUNNING")) {
        set({ rebuildRequested: false });
      }
    }
  },
}));
