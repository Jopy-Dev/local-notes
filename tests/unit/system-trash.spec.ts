import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NoteMutationService } from "../../src/backend/filesystem/note-mutations.js";
import { encodeNoteKey, WorkspacePathGuard } from "../../src/backend/filesystem/path-guard.js";

/*
 * The OS recycle bin is the external boundary, so `trash` is mocked here.
 * `trash` globs its input by default: an archived note named `report[1].md`
 * would also send a sibling `report1.md` to the recycle bin on POSIX paths.
 * The production trash call must hand over the literal path only.
 */
const trashMock = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("trash", () => ({ default: trashMock }));

let root: string;

beforeEach(async () => {
  trashMock.mockClear();
  root = await mkdtemp(join(tmpdir(), "ln-system-trash-"));
  await mkdir(join(root, "save-data", "notes"), { recursive: true });
  await mkdir(join(root, "save-data", "archive"), { recursive: true });
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("system recycle bin (ADR-009)", () => {
  it("recycles only the literal archived path, never a glob expansion", async () => {
    const archiveDir = join(root, "save-data", "archive");
    await writeFile(join(archiveDir, "report[1].md"), "target", "utf8");
    await writeFile(join(archiveDir, "report1.md"), "sibling", "utf8");
    const service = new NoteMutationService(await WorkspacePathGuard.create(root));

    await service.deleteArchived(encodeNoteKey("report[1].md"));

    expect(trashMock).toHaveBeenCalledTimes(1);
    expect(trashMock).toHaveBeenCalledWith(join(archiveDir, "report[1].md"), { glob: false });
  });
});
