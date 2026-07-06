import { describe, expect, it, vi } from "vitest";
import { EventBus } from "../../src/backend/events/event-bus.js";
import type { WorkspaceEvent } from "../../src/backend/events/event-bus.js";
import type { SearchEnginePort, EngineMutationOutcome } from "../../src/backend/search/search-engine.js";
import type { RebuildEntry } from "../../src/backend/search/search-index.js";
import { SearchService } from "../../src/backend/search/search-service.js";
import type { EngineCounts } from "../../src/backend/search/worker-protocol.js";
import type { NoteMetadata } from "../../src/shared/schemas/notes.js";

/*
 * Worker crash policy per MasterPrompt.md 4.3: degraded on crash, one
 * automatic restart + rebuild, repeated crash stays degraded until the
 * explicit recovery-screen rebuild (which re-arms the restart budget).
 * Service lifecycle/checkpoints live in search-service.spec.ts; the real
 * thread in tests/integration/search-worker.spec.ts.
 */
const meta = (relativePath: string): NoteMetadata => ({
  noteKey: Buffer.from(relativePath).toString("base64url"),
  relativePath,
  filename: relativePath,
  title: relativePath.replace(".md", ""),
  extension: ".md",
  folder: "",
  createdAt: null,
  modifiedAt: "2026-07-01T00:00:00.000Z",
  sizeBytes: 10,
  versionToken: "0".repeat(64),
  oversized: false,
  preview: "",
});

class CrashableEngine implements SearchEnginePort {
  running = true;
  respawns = 0;
  rebuilds = 0;
  private crashHandler: (() => void) | null = null;

  crash(): void {
    this.running = false;
    this.crashHandler?.();
  }

  onCrash(handler: () => void): void {
    this.crashHandler = handler;
  }

  async ensureRunning(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.respawns += 1;
  }

  async init(entries: RebuildEntry[]): Promise<EngineCounts> {
    return { indexedNotes: entries.length, metadataOnlyNotes: 0 };
  }

  async rebuild(entries: RebuildEntry[]): Promise<EngineCounts> {
    if (!this.running) throw new Error("Search worker is not running.");
    this.rebuilds += 1;
    return { indexedNotes: entries.length, metadataOnlyNotes: 0 };
  }

  async upsert(): Promise<EngineMutationOutcome> {
    return { counts: { indexedNotes: 1, metadataOnlyNotes: 0 }, rebalanceCandidates: [] };
  }

  async remove(): Promise<EngineMutationOutcome> {
    return { counts: { indexedNotes: 0, metadataOnlyNotes: 0 }, rebalanceCandidates: [] };
  }

  async page() {
    return { results: [], total: 0, hasMore: false };
  }

  async snapshot() {
    return [];
  }

  async status(): Promise<EngineCounts> {
    return { indexedNotes: 0, metadataOnlyNotes: 0 };
  }

  async close(): Promise<void> {}
}

function crashHarness(withNotes = true) {
  const bus = new EventBus();
  const events: WorkspaceEvent[] = [];
  bus.subscribe((event) => events.push(event));
  const engine = new CrashableEngine();
  const service = new SearchService({
    engine,
    bus,
    contentFor: async () => ({ content: "words", truncated: false }),
    ...(withNotes ? { notesFor: async () => [meta("a.md")] } : {}),
  });
  return { service, engine, events };
}

describe("SearchService worker crash policy", () => {
  it("crash degrades, restarts the worker once, and rebuilds back to ready", async () => {
    const { service, engine, events } = crashHarness();
    await service.initialize([meta("a.md")]);
    engine.crash();
    await vi.waitFor(() => expect(service.status().state).toBe("ready"));
    expect(engine.respawns).toBe(1);
    expect(engine.rebuilds).toBe(1);
    const statuses = events
      .filter((event) => event.type === "index.status")
      .map((event) => (event as { status: string }).status);
    expect(statuses).toEqual(["building", "ready", "degraded", "building", "ready"]);
  });

  it("a crash after the restart budget is spent stays degraded", async () => {
    const { service, engine } = crashHarness();
    await service.initialize([meta("a.md")]);
    engine.crash();
    await vi.waitFor(() => expect(service.status().state).toBe("ready"));
    engine.crash();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(service.status().state).toBe("degraded");
    expect(engine.respawns).toBe(1);
    expect(engine.rebuilds).toBe(1);
  });

  it("explicit rebuild recovers a repeatedly crashed worker and re-arms the restart", async () => {
    const { service, engine } = crashHarness();
    await service.initialize([meta("a.md")]);
    engine.crash();
    await vi.waitFor(() => expect(service.status().state).toBe("ready"));
    engine.crash();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(service.status().state).toBe("degraded");

    // Recovery-screen path: explicit rebuild respawns and re-arms.
    await service.rebuild([meta("a.md"), meta("b.md")]);
    expect(service.status().state).toBe("ready");
    expect(engine.respawns).toBe(2);

    engine.crash();
    await vi.waitFor(() => expect(service.status().state).toBe("ready"));
    expect(engine.respawns).toBe(3);
  });

  it("crash without a notes source stays degraded and never restarts", async () => {
    const { service, engine } = crashHarness(false);
    await service.initialize([meta("a.md")]);
    engine.crash();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(service.status().state).toBe("degraded");
    expect(engine.respawns).toBe(0);
  });
});
