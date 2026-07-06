import { join } from "node:path";
import type { NoteMetadata } from "../../shared/schemas/notes.js";
import type { EventBus } from "../events/event-bus.js";
import type { WorkspacePathGuard } from "../filesystem/path-guard.js";
import { readIndexableContent } from "./search-content.js";
import { SearchIndexCache } from "./search-index-cache.js";
import { SearchService } from "./search-service.js";
import { WorkerSearchEngine, resolveSearchWorkerPath, spawnSearchWorker } from "./worker-engine.js";

/*
 * Production wiring for the search service: content reads pass through the
 * workspace path guard; the disposable index cache lives under cache/. The
 * engine prefers the compiled worker thread (MasterPrompt.md 4.3) and falls
 * back in-process when no dist build exists (dev tree) - the caller surfaces
 * the fallback warning.
 */
export interface CreateSearchServiceOptions {
  guard: WorkspacePathGuard;
  workspaceRoot: string;
  notesRelRoot: string;
  bus?: EventBus;
  notesFor?: () => Promise<readonly NoteMetadata[]>;
  /* "auto" (default) takes the compiled worker when present; tests pin "in-process" for determinism. */
  preferredEngine?: "auto" | "in-process";
}

export type SearchEngineKind = "worker" | "in-process";

export interface CreatedSearchService {
  service: SearchService;
  engineKind: SearchEngineKind;
}

export function createSearchService(options: CreateSearchServiceOptions): CreatedSearchService {
  const workerPath = options.preferredEngine === "in-process" ? null : resolveSearchWorkerPath();
  const engine = workerPath
    ? new WorkerSearchEngine(() => spawnSearchWorker(workerPath))
    : undefined;
  const service = new SearchService({
    ...(engine ? { engine } : {}),
    ...(options.bus ? { bus: options.bus } : {}),
    ...(options.notesFor ? { notesFor: options.notesFor } : {}),
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
  return { service, engineKind: workerPath ? "worker" : "in-process" };
}
