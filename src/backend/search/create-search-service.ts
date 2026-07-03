import { join } from "node:path";
import type { EventBus } from "../events/event-bus.js";
import type { WorkspacePathGuard } from "../filesystem/path-guard.js";
import { readIndexableContent } from "./search-content.js";
import { SearchIndexCache } from "./search-index-cache.js";
import { SearchService } from "./search-service.js";

/*
 * Production wiring for the search service: content reads pass through the
 * workspace path guard; the disposable index cache lives under cache/.
 */
export interface CreateSearchServiceOptions {
  guard: WorkspacePathGuard;
  workspaceRoot: string;
  notesRelRoot: string;
  bus?: EventBus;
}

export function createSearchService(options: CreateSearchServiceOptions): SearchService {
  return new SearchService({
    ...(options.bus ? { bus: options.bus } : {}),
    cache: new SearchIndexCache(join(options.workspaceRoot, "cache")),
    contentFor: async (note) => {
      try {
        const absPath = await options.guard.resolve(`${options.notesRelRoot}/${note.relativePath}`);
        return await readIndexableContent(absPath);
      } catch {
        // Unreadable or newly-escaping paths stay metadata-only searchable.
        return { content: null, truncated: false };
      }
    },
  });
}
