import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import type { NoteMetadata } from "../../shared/schemas/notes.js";
import type { SearchResponse } from "../../shared/schemas/search.js";
import type { SearchEnginePort, EngineMutationOutcome } from "./search-engine.js";
import type { CachedIndexEntry } from "./search-index-cache.js";
import type { RebuildEntry } from "./search-index.js";
import type {
  EngineCounts,
  WorkerRequest,
  WorkerRequestType,
  WorkerResponse,
  WorkerSuccess,
} from "./worker-protocol.js";

/*
 * Worker-thread engine host (MasterPrompt.md 4.3): correlates requests by
 * requestId, rejects everything in flight when the thread dies, and reports
 * unexpected death through onCrash so SearchService can run the
 * degrade -> restart-once policy. Never restarts on its own.
 */
export interface WorkerLike {
  postMessage(value: unknown): void;
  on(event: "message", listener: (value: unknown) => void): void;
  on(event: "error", listener: (error: Error) => void): void;
  on(event: "exit", listener: (code: number) => void): void;
  terminate(): Promise<number>;
  unref(): void;
}

export type SpawnSearchWorker = () => WorkerLike;

/*
 * Compiled worker only: candidate 1 is the packaged/dist sibling, candidate 2
 * is the dist build seen from the src tree (vite-node dev, vitest). Node's
 * type stripping cannot follow the .js import specifiers in .ts sources, so
 * there is no source-tree candidate.
 */
export function resolveSearchWorkerPath(): string | null {
  const candidates = [
    new URL("./search-worker.js", import.meta.url),
    new URL("../../../dist/backend/search/search-worker.js", import.meta.url),
  ];
  for (const candidate of candidates) {
    const path = fileURLToPath(candidate);
    if (existsSync(path)) return path;
  }
  return null;
}

export function spawnSearchWorker(workerPath: string): WorkerLike {
  return new Worker(workerPath);
}

/* Omit must distribute over the request union to keep per-type payloads. */
type OutgoingRequest<T = WorkerRequest> = T extends unknown ? Omit<T, "requestId"> : never;

interface PendingRequest {
  expectedType: WorkerRequestType;
  resolve: (response: WorkerSuccess) => void;
  reject: (error: Error) => void;
}

export class WorkerSearchEngine implements SearchEnginePort {
  private worker: WorkerLike | null = null;
  private nextRequestId = 1;
  private readonly pending = new Map<number, PendingRequest>();
  private crashHandler: (() => void) | null = null;
  private closing = false;

  constructor(private readonly spawnWorker: SpawnSearchWorker) {
    this.start();
  }

  onCrash(handler: () => void): void {
    this.crashHandler = handler;
  }

  async ensureRunning(): Promise<void> {
    if (!this.worker && !this.closing) this.start();
  }

  async init(entries: RebuildEntry[]): Promise<EngineCounts> {
    const response = await this.request({ type: "INIT", entries });
    if (response.type !== "INIT") throw new Error("Search worker response type mismatch.");
    return response.counts;
  }

  async rebuild(entries: RebuildEntry[]): Promise<EngineCounts> {
    const response = await this.request({ type: "REBUILD", entries });
    if (response.type !== "REBUILD") throw new Error("Search worker response type mismatch.");
    return response.counts;
  }

  async upsert(
    metadata: NoteMetadata,
    content: string | null,
    truncated: boolean,
  ): Promise<EngineMutationOutcome> {
    const response = await this.request({ type: "UPSERT", metadata, content, truncated });
    if (response.type !== "UPSERT") throw new Error("Search worker response type mismatch.");
    return { counts: response.counts, rebalanceCandidates: response.rebalanceCandidates };
  }

  async remove(noteKey: string): Promise<EngineMutationOutcome> {
    const response = await this.request({ type: "REMOVE", noteKey });
    if (response.type !== "REMOVE") throw new Error("Search worker response type mismatch.");
    return { counts: response.counts, rebalanceCandidates: response.rebalanceCandidates };
  }

  async page(query: string, offset: number): Promise<SearchResponse> {
    const response = await this.request({ type: "SEARCH", query, offset });
    if (response.type !== "SEARCH") throw new Error("Search worker response type mismatch.");
    return response.page;
  }

  async snapshot(): Promise<CachedIndexEntry[]> {
    const response = await this.request({ type: "SAVE" });
    if (response.type !== "SAVE") throw new Error("Search worker response type mismatch.");
    return response.entries;
  }

  async status(): Promise<EngineCounts> {
    const response = await this.request({ type: "STATUS" });
    if (response.type !== "STATUS") throw new Error("Search worker response type mismatch.");
    return response.counts;
  }

  async close(): Promise<void> {
    this.closing = true;
    const worker = this.worker;
    if (!worker) return;
    await this.request({ type: "SHUTDOWN" }).catch(() => undefined);
    // SHUTDOWN exits the thread; terminate is an idempotent safety net.
    await worker.terminate().catch(() => undefined);
  }

  private start(): void {
    const worker = this.spawnWorker();
    this.worker = worker;
    // Never hold the host process open: server lifetime owns shutdown.
    worker.unref();
    worker.on("message", (value) => this.onMessage(value));
    worker.on("error", () => this.onDeath(worker));
    worker.on("exit", () => this.onDeath(worker));
  }

  private onMessage(value: unknown): void {
    const response = value as WorkerResponse;
    const entry = this.pending.get(response.requestId);
    if (!entry) return;
    this.pending.delete(response.requestId);
    if (!response.ok) entry.reject(new Error(response.error));
    else if (response.type !== entry.expectedType) {
      entry.reject(new Error("Search worker response type mismatch."));
    } else entry.resolve(response);
  }

  private onDeath(worker: WorkerLike): void {
    if (this.worker !== worker) return;
    this.worker = null;
    const inFlight = [...this.pending.values()];
    this.pending.clear();
    for (const entry of inFlight) entry.reject(new Error("Search worker stopped."));
    if (!this.closing) this.crashHandler?.();
  }

  private request(message: OutgoingRequest): Promise<WorkerSuccess> {
    const worker = this.worker;
    if (!worker) return Promise.reject(new Error("Search worker is not running."));
    const requestId = this.nextRequestId++;
    return new Promise<WorkerSuccess>((resolve, reject) => {
      this.pending.set(requestId, { expectedType: message.type, resolve, reject });
      worker.postMessage({ ...message, requestId });
    });
  }
}
