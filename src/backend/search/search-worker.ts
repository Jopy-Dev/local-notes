import { parentPort } from "node:worker_threads";
import { collectRebalanceCandidates, snapshotIndexEntries } from "./search-engine.js";
import { SearchIndex } from "./search-index.js";
import type { WorkerRequest, WorkerResponse, WorkerSuccess } from "./worker-protocol.js";

/*
 * Search worker entry (MasterPrompt.md 4.3): owns the Orama-backed
 * SearchIndex and its serialization. Runs only as compiled JS from dist -
 * Node cannot resolve this file's .js import specifiers when loading the .ts
 * source directly (worker-engine.ts resolves the dist path).
 */
const port = parentPort;
if (!port) throw new Error("search-worker must be started as a worker thread.");

const index = new SearchIndex();

function handle(request: WorkerRequest): WorkerSuccess {
  const { requestId } = request;
  switch (request.type) {
    case "INIT":
      index.rebuild(request.entries);
      return { type: "INIT", requestId, ok: true, counts: index.status() };
    case "REBUILD":
      index.rebuild(request.entries);
      return { type: "REBUILD", requestId, ok: true, counts: index.status() };
    case "UPSERT":
      index.upsert(request.metadata, request.content, request.truncated);
      return {
        type: "UPSERT",
        requestId,
        ok: true,
        counts: index.status(),
        rebalanceCandidates: collectRebalanceCandidates(index),
      };
    case "REMOVE":
      index.remove(request.noteKey);
      return {
        type: "REMOVE",
        requestId,
        ok: true,
        counts: index.status(),
        rebalanceCandidates: collectRebalanceCandidates(index),
      };
    case "SEARCH":
      return { type: "SEARCH", requestId, ok: true, page: index.page(request.query, request.offset) };
    case "SAVE":
      return { type: "SAVE", requestId, ok: true, entries: snapshotIndexEntries(index) };
    case "STATUS":
      return { type: "STATUS", requestId, ok: true, counts: index.status() };
    case "SHUTDOWN":
      return { type: "SHUTDOWN", requestId, ok: true };
  }
}

port.on("message", (request: WorkerRequest) => {
  try {
    const response = handle(request);
    port.postMessage(response);
    if (request.type === "SHUTDOWN") process.exit(0);
  } catch (error) {
    const failure: WorkerResponse = {
      type: request.type,
      requestId: request.requestId,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
    port.postMessage(failure);
  }
});
