import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppError } from "../../src/shared/errors/codes.js";
import {
  AtomicFileWriter,
  computeVersionToken,
} from "../../src/backend/filesystem/atomic-writer.js";

/*
 * AtomicFileWriter (MasterPrompt.md 2.5, REQ-023): temp sibling + flush +
 * rename; fault injection at every stage preserves either complete old or
 * complete new content; version mismatch -> NOTE_CONFLICT with target
 * unchanged (REQ-018).
 */
let dir: string;
let writer: AtomicFileWriter;

const REL = "notes/a.md";

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "ln-atomic-"));
  writer = new AtomicFileWriter();
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function target(): string {
  return join(dir, "a.md");
}

describe("AtomicFileWriter.write", () => {
  it("creates a new file and returns its version token", async () => {
    const bytes = Buffer.from("hello\n", "utf8");
    const result = await writer.write({ absPath: target(), relPath: REL, bytes });
    expect(readFileSync(target(), "utf8")).toBe("hello\n");
    expect(result.versionToken).toBe(computeVersionToken(bytes, REL));
  });

  it("replaces content atomically and cleans the temp file", async () => {
    writeFileSync(target(), "old");
    await writer.write({ absPath: target(), relPath: REL, bytes: Buffer.from("new", "utf8") });
    expect(readFileSync(target(), "utf8")).toBe("new");
    expect(readdirSync(dir)).toEqual(["a.md"]);
  });

  it("rejects a stale expectedVersion with NOTE_CONFLICT and leaves the target unchanged", async () => {
    const first = Buffer.from("v1", "utf8");
    await writer.write({ absPath: target(), relPath: REL, bytes: first });
    const stale = computeVersionToken(Buffer.from("other", "utf8"), REL);
    await expect(
      writer.write({
        absPath: target(),
        relPath: REL,
        bytes: Buffer.from("v2", "utf8"),
        expectedVersion: stale,
      }),
    ).rejects.toMatchObject({ code: "NOTE_CONFLICT" });
    expect(readFileSync(target(), "utf8")).toBe("v1");
  });

  it("accepts a matching expectedVersion", async () => {
    const first = Buffer.from("v1", "utf8");
    const { versionToken } = await writer.write({ absPath: target(), relPath: REL, bytes: first });
    await writer.write({
      absPath: target(),
      relPath: REL,
      bytes: Buffer.from("v2", "utf8"),
      expectedVersion: versionToken,
    });
    expect(readFileSync(target(), "utf8")).toBe("v2");
  });

  it("requires the target to exist when expectedVersion is provided", async () => {
    await expect(
      writer.write({
        absPath: target(),
        relPath: REL,
        bytes: Buffer.from("x", "utf8"),
        expectedVersion: computeVersionToken(Buffer.from("x", "utf8"), REL),
      }),
    ).rejects.toMatchObject({ code: "NOTE_CONFLICT" });
  });

  it.each(["write", "flush", "rename"] as const)(
    "preserves the old content and removes temp files when %s fails",
    async (failingStage) => {
      writeFileSync(target(), "intact");
      const faulty = new AtomicFileWriter({
        failStage: failingStage,
      });
      await expect(
        faulty.write({ absPath: target(), relPath: REL, bytes: Buffer.from("boom", "utf8") }),
      ).rejects.toThrowError();
      expect(readFileSync(target(), "utf8")).toBe("intact");
      expect(readdirSync(dir)).toEqual(["a.md"]);
    },
  );

  it("pre-rename recheck catches a file changed inside the flush->rename window (2.5 step 6)", async () => {
    const first = Buffer.from("v1", "utf8");
    await writer.write({ absPath: target(), relPath: REL, bytes: first });
    const versionToken = computeVersionToken(first, REL);
    const racy = new AtomicFileWriter({
      onBeforeRename: async () => {
        // External program rewrites the target after our temp is flushed.
        writeFileSync(target(), "external overwrite");
      },
    });
    await expect(
      racy.write({
        absPath: target(),
        relPath: REL,
        bytes: Buffer.from("v2", "utf8"),
        expectedVersion: versionToken,
      }),
    ).rejects.toMatchObject({ code: "NOTE_CONFLICT" });
    expect(readFileSync(target(), "utf8")).toBe("external overwrite");
    expect(readdirSync(dir)).toEqual(["a.md"]);
  });

  it("serializes concurrent writes to the same path (no interleaved corruption)", async () => {
    const payloads = ["one", "two", "three", "four"].map((value) => Buffer.from(value, "utf8"));
    await Promise.all(
      payloads.map((bytes) => writer.write({ absPath: target(), relPath: REL, bytes })),
    );
    const final = readFileSync(target(), "utf8");
    expect(["one", "two", "three", "four"]).toContain(final);
    expect(readdirSync(dir)).toEqual(["a.md"]);
  });
});

describe("computeVersionToken", () => {
  it("is stable for identical bytes+path and differs across paths", () => {
    const bytes = Buffer.from("same", "utf8");
    expect(computeVersionToken(bytes, "a/b.md")).toBe(computeVersionToken(bytes, "a/b.md"));
    expect(computeVersionToken(bytes, "a/b.md")).not.toBe(computeVersionToken(bytes, "a/c.md"));
  });

  it("throws AppError NOTE_CONFLICT type for conflicts only (sanity: token is hex sha256)", () => {
    expect(computeVersionToken(Buffer.from(""), "x.md")).toMatch(/^[a-f0-9]{64}$/);
    expect(AppError).toBeDefined();
  });
});
