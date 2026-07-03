import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MetadataCache } from "../../src/backend/filesystem/metadata-cache.js";
import { NoteRepository } from "../../src/backend/filesystem/note-repository.js";
import { WorkspacePathGuard } from "../../src/backend/filesystem/path-guard.js";

/*
 * Metadata cache (MasterPrompt.md 2.8, REQ-024): disposable accelerator,
 * never source of truth. Invalid/corrupt/mismatched cache -> null (rebuild),
 * never deletes source files. Warm scan reuses entries when path+size+mtime
 * match and produces results identical to a cold scan.
 */
let root: string;
let cacheDir: string;
let repository: NoteRepository;
let cache: MetadataCache;

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), "ln-cache-"));
  mkdirSync(join(root, "notes"), { recursive: true });
  mkdirSync(join(root, "cache"), { recursive: true });
  writeFileSync(join(root, "notes", "a.md"), "alpha");
  writeFileSync(join(root, "notes", "b.txt"), "bravo");
  const guard = await WorkspacePathGuard.create(root);
  repository = new NoteRepository(guard, "notes");
  cacheDir = join(root, "cache");
  cache = new MetadataCache(cacheDir);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("MetadataCache", () => {
  it("round-trips saved metadata", async () => {
    const notes = await repository.scan();
    await cache.save(notes);
    const loaded = await cache.load();
    expect(loaded).toEqual(notes);
  });

  it("returns null for missing, corrupt, or version-mismatched cache without touching sources", async () => {
    expect(await cache.load()).toBeNull();
    writeFileSync(join(cacheDir, "metadata-v1.json"), "{corrupt");
    expect(await cache.load()).toBeNull();
    writeFileSync(
      join(cacheDir, "metadata-v1.json"),
      JSON.stringify({ schemaVersion: 99, generatedAt: "x", notes: [] }),
    );
    expect(await cache.load()).toBeNull();
    expect(readFileSync(join(root, "notes", "a.md"), "utf8")).toBe("alpha");
  });

  it("warm scan equals cold scan when nothing changed", async () => {
    const cold = await repository.scan();
    const warm = await repository.scan(cold);
    expect(warm).toEqual(cold);
  });

  it("warm scan refreshes changed files and drops deleted ones", async () => {
    const cold = await repository.scan();
    writeFileSync(join(root, "notes", "a.md"), "alpha CHANGED content");
    rmSync(join(root, "notes", "b.txt"));
    writeFileSync(join(root, "notes", "c.md"), "new");
    const warm = await repository.scan(cold);
    const paths = warm.map((note) => note.relativePath).sort();
    expect(paths).toEqual(["a.md", "c.md"]);
    const changed = warm.find((note) => note.relativePath === "a.md");
    const original = cold.find((note) => note.relativePath === "a.md");
    expect(changed?.versionToken).not.toBe(original?.versionToken);
  });
});
