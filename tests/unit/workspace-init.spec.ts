import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { initWorkspace, WORKSPACE_DIRECTORIES } from "../../src/backend/filesystem/workspace-init.js";

/*
 * Workspace initialization (MasterPrompt.md 2.2, REQ-002): first launch
 * creates the directory tree without deleting existing content; deferred
 * directories exist for forward compatibility.
 */
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "ln-init-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("initWorkspace", () => {
  it("creates the full directory tree including deferred directories", async () => {
    await initWorkspace(dir);
    for (const relative of WORKSPACE_DIRECTORIES) {
      expect(existsSync(join(dir, relative)), relative).toBe(true);
    }
    expect(WORKSPACE_DIRECTORIES).toContain("save-data/notes");
    expect(WORKSPACE_DIRECTORIES).toContain("save-data/archive");
    expect(WORKSPACE_DIRECTORIES).toContain("cache");
    expect(WORKSPACE_DIRECTORIES).toContain("logs");
  });

  it("preserves existing files and is idempotent", async () => {
    await initWorkspace(dir);
    writeFileSync(join(dir, "save-data", "notes", "keep.md"), "content");
    await initWorkspace(dir);
    expect(readFileSync(join(dir, "save-data", "notes", "keep.md"), "utf8")).toBe("content");
  });
});
