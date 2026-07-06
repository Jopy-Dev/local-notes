import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NoteMutationService } from "../../src/backend/filesystem/note-mutations.js";
import { encodeNoteKey, WorkspacePathGuard } from "../../src/backend/filesystem/path-guard.js";

/*
 * Create/move/archive per REQ-011/012/013 + MasterPrompt.md 4.4: exclusive
 * create, Unicode case-fold collisions, archive preserves relative structure,
 * no overwrite, no auto-suffix, failures leave sources unchanged.
 */
let root: string;
let service: NoteMutationService;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "ln-mutations-"));
  await mkdir(join(root, "save-data", "notes", "projects"), { recursive: true });
  await mkdir(join(root, "save-data", "archive"), { recursive: true });
  const guard = await WorkspacePathGuard.create(root);
  service = new NoteMutationService(guard);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const notesDir = () => join(root, "save-data", "notes");

describe("create note (REQ-011)", () => {
  it("creates an empty UTF-8 file in an existing folder and returns metadata", async () => {
    const created = await service.create({ filename: "fresh", extension: ".md", folderKey: "projects" });
    expect(created.relativePath).toBe("projects/fresh.md");
    expect(created.noteKey).toBe(encodeNoteKey("projects/fresh.md"));
    expect(await readFile(join(notesDir(), "projects", "fresh.md"), "utf8")).toBe("");
  });

  it("rejects case-insensitive collisions without touching the existing file", async () => {
    await writeFile(join(notesDir(), "projects", "Taken.md"), "original", "utf8");
    await expect(
      service.create({ filename: "taken", extension: ".md", folderKey: "projects" }),
    ).rejects.toMatchObject({ code: "NOTE_EXISTS" });
    expect(await readFile(join(notesDir(), "projects", "Taken.md"), "utf8")).toBe("original");
  });

  it("rejects invalid filenames with INVALID_FILENAME and creates nothing", async () => {
    await expect(
      service.create({ filename: "bad|name", extension: ".md", folderKey: "" }),
    ).rejects.toMatchObject({ code: "INVALID_FILENAME" });
    await expect(
      service.create({ filename: "trailing.", extension: ".txt", folderKey: "" }),
    ).rejects.toMatchObject({ code: "INVALID_FILENAME" });
    expect(await readdir(notesDir())).toEqual(["projects"]);
  });

  it("rejects a missing destination folder", async () => {
    await expect(
      service.create({ filename: "orphan", extension: ".md", folderKey: "nope" }),
    ).rejects.toMatchObject({ code: "FOLDER_NOT_FOUND" });
  });
});

describe("move note (REQ-012)", () => {
  it("moves one note without content change and returns the new key", async () => {
    await writeFile(join(notesDir(), "roam.md"), "wander", "utf8");
    const moved = await service.move(encodeNoteKey("roam.md"), "projects");
    expect(moved.relativePath).toBe("projects/roam.md");
    expect(await readFile(join(notesDir(), "projects", "roam.md"), "utf8")).toBe("wander");
  });

  it("rejects destination collisions case-insensitively and leaves the source", async () => {
    await writeFile(join(notesDir(), "clash.md"), "source", "utf8");
    await writeFile(join(notesDir(), "projects", "CLASH.md"), "existing", "utf8");
    await expect(service.move(encodeNoteKey("clash.md"), "projects")).rejects.toMatchObject({
      code: "NOTE_EXISTS",
    });
    expect(await readFile(join(notesDir(), "clash.md"), "utf8")).toBe("source");
    expect(await readFile(join(notesDir(), "projects", "CLASH.md"), "utf8")).toBe("existing");
  });

  it("rejects a missing destination folder", async () => {
    await writeFile(join(notesDir(), "lost.md"), "x", "utf8");
    await expect(service.move(encodeNoteKey("lost.md"), "missing")).rejects.toMatchObject({
      code: "FOLDER_NOT_FOUND",
    });
  });
});

describe("archive note (REQ-013)", () => {
  it("archives preserving the relative folder structure", async () => {
    await writeFile(join(notesDir(), "projects", "done.md"), "finished", "utf8");
    const result = await service.archive(encodeNoteKey("projects/done.md"));
    expect(result.archivedRelativePath).toBe("projects/done.md");
    expect(await readFile(join(root, "save-data", "archive", "projects", "done.md"), "utf8")).toBe(
      "finished",
    );
    await expect(readFile(join(notesDir(), "projects", "done.md"))).rejects.toThrow();
  });

  it("archive collision rejects with renameAllowed and changes nothing", async () => {
    await writeFile(join(notesDir(), "dup.md"), "active", "utf8");
    await mkdir(join(root, "save-data", "archive"), { recursive: true });
    await writeFile(join(root, "save-data", "archive", "DUP.md"), "archived", "utf8");
    await expect(service.archive(encodeNoteKey("dup.md"))).rejects.toMatchObject({
      code: "ARCHIVE_COLLISION",
    });
    expect(await readFile(join(notesDir(), "dup.md"), "utf8")).toBe("active");
    expect(await readFile(join(root, "save-data", "archive", "DUP.md"), "utf8")).toBe("archived");
  });

  it("rename-then-archive uses create validation and archives under the new name", async () => {
    await writeFile(join(notesDir(), "dup.md"), "active", "utf8");
    await writeFile(join(root, "save-data", "archive", "dup.md"), "archived", "utf8");
    await expect(service.archive(encodeNoteKey("dup.md"), "bad|name.md")).rejects.toMatchObject({
      code: "INVALID_FILENAME",
    });
    const result = await service.archive(encodeNoteKey("dup.md"), "dup-2026.md");
    expect(result.archivedRelativePath).toBe("dup-2026.md");
    expect(await readFile(join(root, "save-data", "archive", "dup-2026.md"), "utf8")).toBe("active");
  });
});

describe("restore archived note (round 2)", () => {
  it("moves the archived file into an existing active folder", async () => {
    await writeFile(join(root, "save-data", "archive", "old.md"), "kept", "utf8");
    const restored = await service.restore(encodeNoteKey("old.md"), "projects");
    expect(restored.relativePath).toBe("projects/old.md");
    expect(await readFile(join(notesDir(), "projects", "old.md"), "utf8")).toBe("kept");
    await expect(readFile(join(root, "save-data", "archive", "old.md"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("rejects case-fold collisions in the destination and leaves both sides unchanged", async () => {
    await writeFile(join(root, "save-data", "archive", "clash.md"), "archived", "utf8");
    await writeFile(join(notesDir(), "projects", "Clash.md"), "active", "utf8");
    await expect(service.restore(encodeNoteKey("clash.md"), "projects")).rejects.toMatchObject({
      code: "NOTE_EXISTS",
    });
    expect(await readFile(join(root, "save-data", "archive", "clash.md"), "utf8")).toBe("archived");
    expect(await readFile(join(notesDir(), "projects", "Clash.md"), "utf8")).toBe("active");
  });

  it("rejects a missing destination folder before touching the archive", async () => {
    await writeFile(join(root, "save-data", "archive", "stay.md"), "archived", "utf8");
    await expect(service.restore(encodeNoteKey("stay.md"), "nope")).rejects.toMatchObject({
      code: "FOLDER_NOT_FOUND",
    });
    expect(await readFile(join(root, "save-data", "archive", "stay.md"), "utf8")).toBe("archived");
  });
});

describe("delete archived note (round 2, ADR-009)", () => {
  it("hands the archived file to the trash function", async () => {
    const trashed: string[] = [];
    const guard = await WorkspacePathGuard.create(root);
    const trashing = new NoteMutationService(guard, async (path) => {
      trashed.push(path);
    });
    await writeFile(join(root, "save-data", "archive", "gone.md"), "bye", "utf8");
    await trashing.deleteArchived(encodeNoteKey("gone.md"));
    expect(trashed).toEqual([join(root, "save-data", "archive", "gone.md")]);
  });

  it("missing archived note maps to NOTE_NOT_FOUND and never calls trash", async () => {
    const trashed: string[] = [];
    const guard = await WorkspacePathGuard.create(root);
    const trashing = new NoteMutationService(guard, async (path) => {
      trashed.push(path);
    });
    await expect(trashing.deleteArchived(encodeNoteKey("ghost.md"))).rejects.toMatchObject({
      code: "NOTE_NOT_FOUND",
    });
    expect(trashed).toEqual([]);
  });
});
