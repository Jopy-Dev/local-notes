import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readdir, lstat } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { OVERSIZED_LIMIT_BYTES, PREVIEW_MAX_CHARS } from "../../shared/schemas/notes.js";
import type { NoteMetadata } from "../../shared/schemas/notes.js";
import { encodeNoteKey } from "./path-guard.js";
import type { WorkspacePathGuard } from "./path-guard.js";

/*
 * NoteRepository (MasterPrompt.md 4.2, REQ-005): recursive discovery under
 * the active notes root with bounded concurrency; skips symlinks/junctions,
 * unsupported extensions, Local-Notes temp artifacts, and unreadable paths
 * (recorded by callers via logs, never aborting the scan). Filesystem stays
 * the source of truth - metadata cache (2.8) only accelerates this scan.
 */
const SCAN_CONCURRENCY = 16;
const SUPPORTED = new Set([".md", ".txt"]);
const TEMP_PREFIX = ".local-notes-tmp-";

interface FileTask {
  absPath: string;
  relPosix: string;
}

function toPosix(relative: string): string {
  return relative.replaceAll("\\", "/");
}

async function collectFiles(
  rootAbs: string,
  relPrefix: string,
  files: FileTask[],
  folders: string[],
): Promise<void> {
  const entries = await readdir(join(rootAbs, relPrefix), { withFileTypes: true }).catch(
    () => [],
  );
  for (const entry of entries) {
    const rel = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      folders.push(rel);
      await collectFiles(rootAbs, rel, files, folders);
      continue;
    }
    if (!entry.isFile()) continue;
    if (entry.name.startsWith(TEMP_PREFIX)) continue;
    if (!SUPPORTED.has(extname(entry.name).toLowerCase())) continue;
    files.push({ absPath: join(rootAbs, rel), relPosix: toPosix(rel) });
  }
}

/* Streaming hash + bounded preview read: oversized files never load whole. */
async function hashAndPreview(
  absPath: string,
): Promise<{ versionSeed: ReturnType<typeof createHash>; preview: string }> {
  const hash = createHash("sha256");
  let previewBytes: Buffer = Buffer.alloc(0);
  const PREVIEW_READ_BYTES = 4096;
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
  return { versionSeed: hash, preview: text.slice(0, PREVIEW_MAX_CHARS) };
}

async function buildMetadata(task: FileTask): Promise<NoteMetadata | null> {
  try {
    const stats = await lstat(task.absPath);
    const { versionSeed, preview } = await hashAndPreview(task.absPath);
    versionSeed.update("\n").update(task.relPosix, "utf8");
    const filename = basename(task.relPosix);
    const extension = extname(filename).toLowerCase() as NoteMetadata["extension"];
    const folderDir = dirname(task.relPosix);
    const birth = stats.birthtimeMs > 0 ? new Date(stats.birthtimeMs).toISOString() : null;
    return {
      noteKey: encodeNoteKey(task.relPosix),
      relativePath: task.relPosix,
      filename,
      title: filename.slice(0, -extension.length),
      extension,
      folder: folderDir === "." ? "" : folderDir,
      createdAt: birth,
      modifiedAt: new Date(stats.mtimeMs).toISOString(),
      sizeBytes: stats.size,
      versionToken: versionSeed.digest("hex"),
      oversized: stats.size > OVERSIZED_LIMIT_BYTES,
      preview,
    };
  } catch {
    return null; // unreadable path: skip, scan continues (REQ-005)
  }
}

export class NoteRepository {
  constructor(
    private readonly guard: WorkspacePathGuard,
    private readonly notesRelRoot: string,
  ) {}

  private async notesRootAbs(): Promise<string> {
    return this.guard.resolve(this.notesRelRoot);
  }

  async scan(): Promise<NoteMetadata[]> {
    const rootAbs = await this.notesRootAbs();
    const files: FileTask[] = [];
    await collectFiles(rootAbs, "", files, []);

    const results: NoteMetadata[] = [];
    for (let index = 0; index < files.length; index += SCAN_CONCURRENCY) {
      const batch = files.slice(index, index + SCAN_CONCURRENCY);
      const settled = await Promise.all(batch.map(buildMetadata));
      for (const entry of settled) if (entry) results.push(entry);
    }
    return results;
  }

  async listFolders(): Promise<string[]> {
    const rootAbs = await this.notesRootAbs();
    const folders: string[] = [];
    await collectFiles(rootAbs, "", [], folders);
    return folders.map(toPosix).sort();
  }
}
