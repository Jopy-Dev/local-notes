import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NoteContentService } from "../../src/backend/filesystem/note-content.js";
import { encodeNoteKey, WorkspacePathGuard } from "../../src/backend/filesystem/path-guard.js";

/*
 * Note open/save (REQ-014/017/019, MasterPrompt.md 4.5): LF-normalized editor
 * content, BOM + CRLF restored on save, invalid UTF-8 and oversized notes are
 * read-only and never enter the save pipeline, stale versions conflict.
 */
let root: string;
let service: NoteContentService;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "ln-content-"));
  await mkdir(join(root, "save-data", "notes"), { recursive: true });
  const guard = await WorkspacePathGuard.create(root);
  service = new NoteContentService(guard);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const notesDir = () => join(root, "save-data", "notes");

describe("read (WF-005)", () => {
  it("returns document with LF content and matching versionToken", async () => {
    await writeFile(join(notesDir(), "plain.md"), "# Title\nBody", "utf8");
    const doc = await service.read(encodeNoteKey("plain.md"));
    expect(doc.content).toBe("# Title\nBody");
    expect(doc.textEncoding).toBe("utf8");
    expect(doc.lineEnding).toBe("lf");
    expect(doc.versionToken).toMatch(/^[a-f0-9]{64}$/);
    expect(doc.markdownCompatibility).toBe("source-only");
  });

  it("normalizes CRLF for the editor but reports the original style", async () => {
    await writeFile(join(notesDir(), "dos.txt"), Buffer.from("﻿line one\r\nline two", "utf8"));
    const doc = await service.read(encodeNoteKey("dos.txt"));
    expect(doc.content).toBe("line one\nline two");
    expect(doc.textEncoding).toBe("utf8-bom");
    expect(doc.lineEnding).toBe("crlf");
  });

  it("invalid UTF-8 is read-only with empty content and never rewritten", async () => {
    await writeFile(join(notesDir(), "binary.md"), Buffer.from([0xff, 0xfe, 0x00]));
    const doc = await service.read(encodeNoteKey("binary.md"));
    expect(doc.textEncoding).toBe("unsupported");
    expect(doc.content).toBe("");
    await expect(
      service.write(encodeNoteKey("binary.md"), "anything", doc.versionToken),
    ).rejects.toMatchObject({ code: "READ_ONLY_NOTE" });
  });

  it("oversized note omits content and rejects writes (REQ-019)", async () => {
    await writeFile(join(notesDir(), "big.md"), Buffer.alloc(5 * 1024 * 1024 + 1, 0x61));
    const doc = await service.read(encodeNoteKey("big.md"));
    expect(doc.oversized).toBe(true);
    expect(doc.content).toBe("");
    await expect(
      service.write(encodeNoteKey("big.md"), "tiny", doc.versionToken),
    ).rejects.toMatchObject({ code: "READ_ONLY_NOTE" });
  });

  it("missing note maps to NOTE_NOT_FOUND", async () => {
    await expect(service.read(encodeNoteKey("ghost.md"))).rejects.toMatchObject({
      code: "NOTE_NOT_FOUND",
    });
  });
});

describe("write (WF-006)", () => {
  it("persists the draft atomically and returns fresh metadata", async () => {
    await writeFile(join(notesDir(), "draft.md"), "old", "utf8");
    const before = await service.read(encodeNoteKey("draft.md"));
    const after = await service.write(encodeNoteKey("draft.md"), "new words", before.versionToken);
    expect(await readFile(join(notesDir(), "draft.md"), "utf8")).toBe("new words");
    expect(after.versionToken).not.toBe(before.versionToken);
    const reread = await service.read(encodeNoteKey("draft.md"));
    expect(reread.versionToken).toBe(after.versionToken);
  });

  it("restores BOM and CRLF style on save (REQ-014 acceptance)", async () => {
    await writeFile(join(notesDir(), "styled.md"), Buffer.from("﻿a\r\nb", "utf8"));
    const doc = await service.read(encodeNoteKey("styled.md"));
    await service.write(encodeNoteKey("styled.md"), "x\ny", doc.versionToken);
    const bytes = await readFile(join(notesDir(), "styled.md"));
    expect(bytes.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
    expect(bytes.subarray(3).toString("utf8")).toBe("x\r\ny");
  });

  it("stale expected version conflicts and leaves the file unchanged", async () => {
    await writeFile(join(notesDir(), "race.md"), "disk", "utf8");
    await expect(
      service.write(encodeNoteKey("race.md"), "draft", "0".repeat(64)),
    ).rejects.toMatchObject({ code: "NOTE_CONFLICT" });
    expect(await readFile(join(notesDir(), "race.md"), "utf8")).toBe("disk");
  });
});
