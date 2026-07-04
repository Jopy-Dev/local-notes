import { describe, expect, it } from "vitest";
import { OperationRegistry } from "../../src/backend/events/operation-registry.js";
import { WatchEventPipeline } from "../../src/backend/watcher/watch-event-pipeline.js";
import { encodeNoteKey } from "../../src/backend/filesystem/path-guard.js";
import type { WorkspaceEvent } from "../../src/backend/events/event-bus.js";
import type { WatchPipelineDeps } from "../../src/backend/watcher/watch-event-pipeline.js";
import type { NoteMetadata } from "../../src/shared/schemas/notes.js";

/*
 * Watch-event pipeline rename correlation (REQ-018, MasterPrompt.md 4.5):
 * unlink+add of the same file (size + mtime match) inside one coalesced
 * batch collapses to a single note.renamed event; unrelated removed/added
 * events pass through unchanged.
 */
const meta = (relativePath: string, overrides: Partial<NoteMetadata> = {}): NoteMetadata => ({
  noteKey: encodeNoteKey(relativePath),
  relativePath,
  filename: relativePath.split("/").at(-1) ?? relativePath,
  title: relativePath,
  extension: ".md",
  folder: "",
  createdAt: null,
  modifiedAt: "2026-07-01T00:00:00.000Z",
  sizeBytes: 10,
  versionToken: "a".repeat(64),
  oversized: false,
  preview: "",
  ...overrides,
});

interface Harness {
  pipeline: WatchEventPipeline;
  events: WorkspaceEvent[];
  removes: string[];
  upserts: string[];
  registry: OperationRegistry;
  setNextScan: (notes: NoteMetadata[]) => void;
}

function harness(initial: NoteMetadata[]): Harness {
  const events: WorkspaceEvent[] = [];
  const removes: string[] = [];
  const upserts: string[] = [];
  const registry = new OperationRegistry();
  let nextScan: NoteMetadata[] = initial;
  const deps = {
    repository: { scan: async () => nextScan },
    cache: { save: async () => undefined },
    bus: { publish: (event: WorkspaceEvent) => void events.push(event) },
    searchService: {
      applyRemove: async (noteKey: string) => void removes.push(noteKey),
      applyUpsert: async (note: NoteMetadata) => void upserts.push(note.relativePath),
    },
    operationRegistry: registry,
  } as unknown as WatchPipelineDeps;
  return {
    pipeline: new WatchEventPipeline(deps, initial),
    events,
    removes,
    upserts,
    registry,
    setNextScan: (notes) => {
      nextScan = notes;
    },
  };
}

describe("WatchEventPipeline rename correlation (REQ-018)", () => {
  it("collapses a removed+added pair with matching size and mtime to note.renamed", async () => {
    const old = meta("a.md");
    const renamed = meta("b.md", { versionToken: "b".repeat(64) });
    const h = harness([old]);
    h.setNextScan([renamed]);

    await h.pipeline.handleBatch([
      { kind: "removed", relPath: "a.md" },
      { kind: "added", relPath: "b.md" },
    ]);

    expect(h.events).toEqual([
      {
        type: "note.renamed",
        oldKey: encodeNoteKey("a.md"),
        noteKey: encodeNoteKey("b.md"),
        version: "b".repeat(64),
      },
    ]);
    expect(h.removes).toEqual([encodeNoteKey("a.md")]);
    expect(h.upserts).toEqual(["b.md"]);
  });

  it("keeps removed+added separate when size or mtime differ", async () => {
    const old = meta("a.md", { sizeBytes: 10 });
    const unrelated = meta("b.md", { sizeBytes: 99 });
    const h = harness([old]);
    h.setNextScan([unrelated]);

    await h.pipeline.handleBatch([
      { kind: "removed", relPath: "a.md" },
      { kind: "added", relPath: "b.md" },
    ]);

    expect(h.events.map((event) => event.type)).toEqual(["note.removed", "note.added"]);
  });

  it("tags note.renamed with the app move operation ID and drains both registry entries", async () => {
    const old = meta("a.md");
    const renamed = meta("sub/a.md", { versionToken: "b".repeat(64) });
    const h = harness([old]);
    h.setNextScan([renamed]);
    h.registry.register("a.md", "op-move-1");
    h.registry.register("sub/a.md", "op-move-1");

    await h.pipeline.handleBatch([
      { kind: "removed", relPath: "a.md" },
      { kind: "added", relPath: "sub/a.md" },
    ]);

    expect(h.events).toHaveLength(1);
    expect(h.events[0]).toMatchObject({ type: "note.renamed", operationId: "op-move-1" });
    // Both single-shot entries consumed - nothing left for later events.
    expect(h.registry.take("a.md")).toBeUndefined();
    expect(h.registry.take("sub/a.md")).toBeUndefined();
  });

  it("leaves plain change events untouched", async () => {
    const note = meta("a.md");
    const h = harness([note]);
    h.setNextScan([{ ...note, versionToken: "c".repeat(64) }]);

    await h.pipeline.handleBatch([{ kind: "changed", relPath: "a.md" }]);

    expect(h.events).toEqual([
      { type: "note.changed", noteKey: encodeNoteKey("a.md"), version: "c".repeat(64) },
    ]);
  });
});
