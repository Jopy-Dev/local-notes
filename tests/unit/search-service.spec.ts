import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventBus } from "../../src/backend/events/event-bus.js";
import type { WorkspaceEvent } from "../../src/backend/events/event-bus.js";
import { SearchIndex } from "../../src/backend/search/search-index.js";
import { SearchService } from "../../src/backend/search/search-service.js";
import type { NoteMetadata } from "../../src/shared/schemas/notes.js";

/* Engine whose search can be poisoned - models a crashed worker (4.3). */
class FailableIndex extends SearchIndex {
  failing = false;

  override search(query: string) {
    if (this.failing) throw new Error("engine crashed");
    return super.search(query);
  }
}

/*
 * Service lifecycle per MasterPrompt.md 4.3: unavailable -> building -> ready,
 * degraded on engine failure, rebuild single-flight, checkpoint saves after
 * 30s idle at most once per 5min, force save on close.
 */
const meta = (relativePath: string, versionToken = "0".repeat(64)): NoteMetadata => ({
  noteKey: Buffer.from(relativePath).toString("base64url"),
  relativePath,
  filename: relativePath,
  title: relativePath.replace(".md", ""),
  extension: ".md",
  folder: "",
  createdAt: null,
  modifiedAt: "2026-07-01T00:00:00.000Z",
  sizeBytes: 10,
  versionToken,
  oversized: false,
  preview: "",
});

interface CachedEntry {
  metadata: NoteMetadata;
  content: string | null;
  contentIndexStatus: "full" | "metadata-only";
  truncated: boolean;
}

interface Harness {
  service: SearchService;
  index: FailableIndex;
  events: WorkspaceEvent[];
  saved: Array<ReadonlyArray<unknown>>;
  contents: Map<string, string>;
}

function harness(cachedEntries: CachedEntry[] | null = null): Harness {
  const bus = new EventBus();
  const events: WorkspaceEvent[] = [];
  bus.subscribe((event) => events.push(event));
  const saved: Array<ReadonlyArray<unknown>> = [];
  const contents = new Map<string, string>();
  const index = new FailableIndex();
  const service = new SearchService({
    index,
    bus,
    cache: {
      load: async () => cachedEntries,
      save: async (entries) => {
        saved.push(entries);
      },
    },
    contentFor: async (note) => ({
      content: contents.get(note.relativePath) ?? `content of ${note.relativePath}`,
      truncated: false,
    }),
  });
  return { service, index, events, saved, contents };
}

describe("SearchService lifecycle", () => {
  it("starts unavailable, reports ready after initialize, and publishes status events", async () => {
    const { service, events } = harness();
    expect(service.status().state).toBe("unavailable");
    await service.initialize([meta("a.md")]);
    expect(service.status().state).toBe("ready");
    expect(service.status().indexedNotes).toBe(1);
    const statusEvents = events.filter((event) => event.type === "index.status");
    expect(statusEvents.map((event) => (event as { status: string }).status)).toEqual([
      "building",
      "ready",
    ]);
  });

  it("search serves ranked pages once ready", async () => {
    const { service, contents } = harness();
    contents.set("hit.md", "a very findable token inside");
    await service.initialize([meta("hit.md"), meta("miss.md")]);
    const page = await service.search("findable", 0);
    expect(page.total).toBe(1);
    expect(page.results[0]?.relativePath).toBe("hit.md");
  });

  it("rebuild is single-flight: concurrent call rejects with REBUILD_RUNNING", async () => {
    const { service } = harness();
    await service.initialize([meta("a.md")]);
    const first = service.rebuild([meta("a.md"), meta("b.md")]);
    await expect(service.rebuild([meta("a.md")])).rejects.toMatchObject({
      code: "REBUILD_RUNNING",
    });
    await first;
    expect(service.status().state).toBe("ready");
    expect(service.status().indexedNotes).toBe(2);
  });

  it("initialize reuses cached content for unchanged versions and re-reads changed notes", async () => {
    const cachedNote = meta("warm.md", "a".repeat(64));
    const { service, contents } = harness([
      { metadata: cachedNote, content: "cached warm words", contentIndexStatus: "full", truncated: false },
    ]);
    contents.set("warm.md", "SHOULD NOT BE READ");
    contents.set("cold.md", "fresh cold words");
    await service.initialize([cachedNote, meta("cold.md")]);
    expect((await service.search("warm", 0)).results[0]?.snippet).toContain("cached warm words");
    expect((await service.search("cold", 0)).total).toBe(1);
  });

  it("degraded search failure raises SEARCH_DEGRADED and emits degraded status", async () => {
    const { service, index, events } = harness();
    await service.initialize([meta("a.md")]);
    index.failing = true;
    await expect(service.search("anything", 0)).rejects.toMatchObject({ code: "SEARCH_DEGRADED" });
    expect(service.status().state).toBe("degraded");
    expect(events.at(-1)).toEqual({ type: "index.status", status: "degraded" });
  });

  it("rebuild recovers a degraded index", async () => {
    const { service, index } = harness();
    await service.initialize([meta("a.md")]);
    index.failing = true;
    await service.search("x", 0).catch(() => undefined);
    index.failing = false;
    await service.rebuild([meta("a.md")]);
    expect(service.status().state).toBe("ready");
    expect((await service.search("a", 0)).total).toBe(1);
  });
});

describe("SearchService checkpoints", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("saves after 30s idle, at most once per 5 minutes", async () => {
    const { service, saved } = harness();
    await service.initialize([meta("a.md")]);
    saved.length = 0;

    await service.applyUpsert(meta("b.md"));
    await vi.advanceTimersByTimeAsync(30_000);
    expect(saved).toHaveLength(1);

    // more churn immediately after: idle timer fires but 5min floor holds
    await service.applyUpsert(meta("c.md"));
    await vi.advanceTimersByTimeAsync(30_000);
    expect(saved).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(saved).toHaveLength(2);
  });

  it("close forces a final save when dirty", async () => {
    const { service, saved } = harness();
    await service.initialize([meta("a.md")]);
    saved.length = 0;
    await service.applyUpsert(meta("b.md"));
    await service.close();
    expect(saved).toHaveLength(1);
  });
});
