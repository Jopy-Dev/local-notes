import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat } from "node:fs/promises";
import { basename, dirname, extname } from "node:path";
import { OVERSIZED_LIMIT_BYTES, PREVIEW_MAX_CHARS } from "../../shared/schemas/notes.js";
import type { NoteMetadata } from "../../shared/schemas/notes.js";
import { encodeNoteKey } from "./path-guard.js";

/*
 * Single-pass metadata builder (MasterPrompt.md 2.3): streaming sha256 (never
 * whole-loads oversized files) + bounded preview window. Warm-scan reuse: a
 * cached entry with matching size + mtime skips hashing entirely (2.8).
 */
const PREVIEW_READ_BYTES = 4096;

async function hashAndPreview(
  absPath: string,
): Promise<{ hash: ReturnType<typeof createHash>; preview: string }> {
  const hash = createHash("sha256");
  let previewBytes: Buffer = Buffer.alloc(0);
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(absPath);
    stream.on("data", (chunk: string | Buffer) => {
      const buffer = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
      hash.update(buffer);
      if (previewBytes.length < PREVIEW_READ_BYTES) {
        previewBytes = Buffer.concat([previewBytes, buffer]).subarray(0, PREVIEW_READ_BYTES);
      }
    });
    stream.on("end", resolve);
    stream.on("error", reject);
  });
  const text = previewBytes.toString("utf8").replaceAll(/\s+/g, " ").trim();
  return { hash, preview: text.slice(0, PREVIEW_MAX_CHARS) };
}

export async function buildNoteMetadata(
  absPath: string,
  relPosix: string,
  cached?: NoteMetadata,
): Promise<NoteMetadata | null> {
  try {
    const stats = await lstat(absPath);
    const modifiedAt = new Date(stats.mtimeMs).toISOString();
    if (cached && cached.sizeBytes === stats.size && cached.modifiedAt === modifiedAt) {
      return cached;
    }
    const { hash, preview } = await hashAndPreview(absPath);
    hash.update("\n").update(relPosix, "utf8");
    const filename = basename(relPosix);
    const extension = extname(filename).toLowerCase() as NoteMetadata["extension"];
    const folderDir = dirname(relPosix);
    return {
      noteKey: encodeNoteKey(relPosix),
      relativePath: relPosix,
      filename,
      title: filename.slice(0, -extension.length),
      extension,
      folder: folderDir === "." ? "" : folderDir,
      createdAt: stats.birthtimeMs > 0 ? new Date(stats.birthtimeMs).toISOString() : null,
      modifiedAt,
      sizeBytes: stats.size,
      versionToken: hash.digest("hex"),
      oversized: stats.size > OVERSIZED_LIMIT_BYTES,
      preview,
    };
  } catch {
    return null; // unreadable path: skip, scan continues (REQ-005)
  }
}
