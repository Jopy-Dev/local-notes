import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decodeNoteKey, WorkspacePathGuard } from "../../src/backend/filesystem/path-guard.js";
import { NoteRepository } from "../../src/backend/filesystem/note-repository.js";
import { sortNotes } from "../../src/backend/filesystem/note-sort.js";
import type { NoteMetadata } from "../../src/shared/schemas/notes.js";

/*
 * NoteRepository.scan (MasterPrompt.md 4.2, REQ-005): recursive discovery of
 * .md/.txt under the notes root; unsupported files, symlinks, and unreadable
 * paths are skipped without aborting; metadata matches 2.3.
 */
let root: string;
let notesRoot: string;
let repository: NoteRepository;

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), "ln-repo-"));
  notesRoot = join(root, "notes");
  mkdirSync(join(notesRoot, "projects", "alpha"), { recursive: true });
  writeFileSync(join(notesRoot, "top.md"), "# Top note\nbody line\n");
  writeFileSync(join(notesRoot, "plain.TXT"), "literal text");
  writeFileSync(join(notesRoot, "projects", "alpha", "deep.md"), "deep content");
  writeFileSync(join(notesRoot, "skip.pdf"), "binary-ish");
  const guard = await WorkspacePathGuard.create(root);
  repository = new NoteRepository(guard, "notes");
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function byPath(notes: NoteMetadata[], relativePath: string): NoteMetadata {
  const found = notes.find((note) => note.relativePath === relativePath);
  if (!found) throw new Error(`missing ${relativePath}`);
  return found;
}

describe("NoteRepository.scan", () => {
  it("discovers nested supported notes once each and skips unsupported files", async () => {
    const notes = await repository.scan();
    expect(notes.map((note) => note.relativePath).sort()).toEqual([
      "plain.TXT",
      "projects/alpha/deep.md",
      "top.md",
    ]);
  });

  it("produces metadata per the canonical contract", async () => {
    const notes = await repository.scan();
    const top = byPath(notes, "top.md");
    expect(top.filename).toBe("top.md");
    expect(top.title).toBe("top");
    expect(top.extension).toBe(".md");
    expect(top.folder).toBe("");
    expect(top.sizeBytes).toBeGreaterThan(0);
    expect(top.modifiedAt).toMatch(/^\d{4}-/);
    expect(top.oversized).toBe(false);
    expect(top.versionToken).toMatch(/^[a-f0-9]{64}$/);
    expect(decodeNoteKey(top.noteKey)).toBe("top.md");
    expect(top.preview).toContain("Top note");
  });

  it("normalizes extension comparison but preserves the stored filename", async () => {
    const notes = await repository.scan();
    const plain = byPath(notes, "plain.TXT");
    expect(plain.extension).toBe(".txt");
    expect(plain.filename).toBe("plain.TXT");
  });

  it("derives folder from the nested relative path", async () => {
    const notes = await repository.scan();
    expect(byPath(notes, "projects/alpha/deep.md").folder).toBe("projects/alpha");
  });

  it("caps preview at 240 characters", async () => {
    writeFileSync(join(notesRoot, "long.md"), "x".repeat(1000));
    const notes = await repository.scan();
    expect(byPath(notes, "long.md").preview.length).toBeLessThanOrEqual(240);
  });

  it("flags files above 5 MiB as oversized without loading them whole", async () => {
    writeFileSync(join(notesRoot, "big.txt"), Buffer.alloc(5 * 1024 * 1024 + 1, 97));
    const notes = await repository.scan();
    expect(byPath(notes, "big.txt").oversized).toBe(true);
  });

  it("skips symlinked entries", async () => {
    try {
      symlinkSync(join(root, "outside-target"), join(notesRoot, "linked"), "junction");
    } catch {
      return;
    }
    const notes = await repository.scan();
    expect(notes.some((note) => note.relativePath.startsWith("linked"))).toBe(false);
  });

  it("lists existing folders for the folder tree", async () => {
    const folders = await repository.listFolders();
    expect(folders).toContain("projects");
    expect(folders).toContain("projects/alpha");
    expect(folders).not.toContain("");
  });
});

describe("sortNotes (REQ-008)", () => {
  const base: Omit<NoteMetadata, "relativePath" | "createdAt" | "modifiedAt" | "sizeBytes"> = {
    noteKey: "k",
    filename: "f.md",
    title: "t",
    extension: ".md",
    folder: "",
    versionToken: "0".repeat(64),
    oversized: false,
    preview: "",
  };
  const note = (
    relativePath: string,
    createdAt: string | null,
    modifiedAt: string,
    sizeBytes: number,
  ): NoteMetadata => ({ ...base, relativePath, createdAt, modifiedAt, sizeBytes });

  const notes = [
    note("b.md", "2026-01-02T00:00:00Z", "2026-06-01T00:00:00Z", 20),
    note("a.md", null, "2026-06-03T00:00:00Z", 10),
    note("c.md", "2026-01-01T00:00:00Z", "2026-06-02T00:00:00Z", 30),
  ];

  it("sorts unknown created times after known values in BOTH directions", () => {
    const ascending = sortNotes(notes, "created", "asc").map((entry) => entry.relativePath);
    expect(ascending).toEqual(["c.md", "b.md", "a.md"]);
    const descending = sortNotes(notes, "created", "desc").map((entry) => entry.relativePath);
    expect(descending).toEqual(["b.md", "c.md", "a.md"]);
  });

  it("is deterministic across repeated sorts (path tiebreak)", () => {
    const first = sortNotes(notes, "modified", "desc").map((entry) => entry.relativePath);
    const second = sortNotes([...notes].reverse(), "modified", "desc").map(
      (entry) => entry.relativePath,
    );
    expect(first).toEqual(second);
  });

  it("sorts by size and by name in both directions", () => {
    expect(sortNotes(notes, "size", "asc")[0]?.sizeBytes).toBe(10);
    expect(sortNotes(notes, "size", "desc")[0]?.sizeBytes).toBe(30);
    expect(sortNotes(notes, "name", "asc")[0]?.relativePath).toBe("a.md");
  });
});
