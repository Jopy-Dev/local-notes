import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readIndexableContent } from "../../src/backend/search/search-content.js";

// Content read for indexing (REQ-019): cap at the first 5 MiB with a
// truncated label; invalid UTF-8 yields metadata-only (null content).
let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "ln-searchcontent-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("readIndexableContent", () => {
  it("reads a small note fully without truncation", async () => {
    const path = join(dir, "small.md");
    await writeFile(path, "hello indexable world", "utf8");
    const result = await readIndexableContent(path, { capBytes: 1024 });
    expect(result).toEqual({ content: "hello indexable world", truncated: false });
  });

  it("caps oversized content and flags truncation", async () => {
    const path = join(dir, "big.md");
    await writeFile(path, "abcdefghij", "utf8");
    const result = await readIndexableContent(path, { capBytes: 4 });
    expect(result.content).toBe("abcd");
    expect(result.truncated).toBe(true);
  });

  it("drops a multibyte character split at the cap boundary instead of failing", async () => {
    const path = join(dir, "split.md");
    // "ab" + é (2 bytes) -> cap 3 slices é in half
    await writeFile(path, Buffer.from("abé", "utf8"));
    const result = await readIndexableContent(path, { capBytes: 3 });
    expect(result.content).toBe("ab");
    expect(result.truncated).toBe(true);
  });

  it("returns null content for invalid UTF-8", async () => {
    const path = join(dir, "binary.md");
    await writeFile(path, Buffer.from([0xff, 0xfe, 0x00, 0xc3, 0x28]));
    const result = await readIndexableContent(path, { capBytes: 1024 });
    expect(result.content).toBeNull();
  });
});
