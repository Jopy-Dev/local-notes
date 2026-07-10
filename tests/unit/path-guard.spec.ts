import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppError } from "../../src/shared/errors/codes.js";
import {
  decodeNoteKey,
  encodeNoteKey,
  validateNoteFilename,
  WorkspacePathGuard,
} from "../../src/backend/filesystem/path-guard.js";

/*
 * WorkspacePathGuard (MasterPrompt.md 2.4, REQ-027): every filesystem
 * operation resolves through one shared guard; escape attempts fail closed
 * with PATH_OUTSIDE_WORKSPACE.
 */
let root: string;
let guard: WorkspacePathGuard;

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), "ln-guard-"));
  mkdirSync(join(root, "notes", "projects"), { recursive: true });
  writeFileSync(join(root, "notes", "a.md"), "x");
  guard = await WorkspacePathGuard.create(root);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("WorkspacePathGuard.resolve", () => {
  it("resolves a valid relative path inside the root", async () => {
    const resolved = await guard.resolve("notes/a.md");
    expect(resolved.toLowerCase()).toContain("ln-guard-");
    expect(resolved.endsWith("a.md")).toBe(true);
  });

  it("resolves nested paths with platform separators normalized", async () => {
    const resolved = await guard.resolve("notes/projects");
    expect(resolved.endsWith("projects")).toBe(true);
  });

  it.each([
    ["absolute posix", "/etc/passwd"],
    ["absolute windows", "C:\\Windows\\system32"],
    ["UNC prefix", "\\\\server\\share\\x"],
    ["NUL byte", "notes/a\u0000.md"],
    ["parent traversal", "../outside.md"],
    ["embedded traversal", "notes/../../outside.md"],
    ["empty segment", "notes//a.md"],
    ["empty path", ""],
  ])("rejects %s", async (_label, candidate) => {
    await expect(guard.resolve(candidate)).rejects.toThrowError(AppError);
    await expect(guard.resolve(candidate)).rejects.toMatchObject({
      code: "PATH_OUTSIDE_WORKSPACE",
    });
  });

  it("rejects symlink traversal for mutable targets", async () => {
    const outside = mkdtempSync(join(tmpdir(), "ln-outside-"));
    try {
      // Directory link: junction on Windows needs no privilege.
      symlinkSync(outside, join(root, "notes", "escape"), "junction");
    } catch {
      return; // platform cannot create links in this environment - covered in CI matrix
    }
    await expect(guard.resolve("notes/escape/x.md", { forWrite: true })).rejects.toMatchObject({
      code: "PATH_OUTSIDE_WORKSPACE",
    });
    rmSync(outside, { recursive: true, force: true });
  });
});

describe("noteKey codec", () => {
  it("round-trips a normalized POSIX relative path", () => {
    const key = encodeNoteKey("projects/local notes/a.md");
    expect(key).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeNoteKey(key)).toBe("projects/local notes/a.md");
  });

  it("rejects keys decoding to escaping or absolute paths", () => {
    const escape = Buffer.from("../x.md", "utf8").toString("base64url");
    expect(() => decodeNoteKey(escape)).toThrowError(AppError);
    const absolute = Buffer.from("/etc/passwd", "utf8").toString("base64url");
    expect(() => decodeNoteKey(absolute)).toThrowError(AppError);
  });

  it("rejects malformed base64url", () => {
    expect(() => decodeNoteKey("not+valid/key=")).toThrowError(AppError);
  });
});

describe("validateNoteFilename (REQ-011)", () => {
  it("accepts a plain filename with supported extension", () => {
    expect(validateNoteFilename("meeting-notes.md")).toEqual({ ok: true });
    expect(validateNoteFilename("plain.txt")).toEqual({ ok: true });
  });

  it.each([
    ["unsupported extension", "notes.pdf"],
    ["missing extension", "notes"],
    ["path separator", "a/b.md"],
    ["backslash", "a\\b.md"],
    ["reserved name", "CON.md"],
    ["trailing dot", "notes..md"],
    ["trailing space before extension", "notes .md"],
    ["invalid char", "no:tes.md"],
    ["empty", ""],
    ["extension only, no stem", ".md"],
  ])("rejects %s", (_label, name) => {
    expect(validateNoteFilename(name).ok).toBe(false);
  });

  it("exposes the canonical real root for callers that join display paths", async () => {
    expect(guard.root.toLowerCase()).toContain("ln-guard-");
  });

  it("enforces 120-char maximum including extension", () => {
    const long = `${"a".repeat(118)}.md`;
    expect(validateNoteFilename(long).ok).toBe(false);
    const exact = `${"a".repeat(117)}.md`;
    expect(validateNoteFilename(exact).ok).toBe(true);
  });
});
