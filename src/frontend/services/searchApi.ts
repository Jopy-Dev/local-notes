import { apiGet, apiPost } from "./api";
import type { SearchResponse } from "../../shared/schemas/search.js";

// Search API (MasterPrompt.md 5.2): ranked batches of 200; rebuild is
// fire-and-forget with progress arriving over SSE index.status.
export function fetchSearchPage(options: {
  q: string;
  offset?: number;
  signal?: AbortSignal;
}): Promise<SearchResponse> {
  const params = new URLSearchParams({ q: options.q });
  if (options.offset) params.set("offset", String(options.offset));
  return apiGet<SearchResponse>(`/search?${params.toString()}`, {
    ...(options.signal ? { signal: options.signal } : {}),
  });
}

export function requestRebuild(): Promise<{ accepted: boolean }> {
  return apiPost<{ accepted: boolean }>("/search/rebuild");
}
