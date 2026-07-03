import { readdir } from "node:fs/promises";
import { extname, join } from "node:path";
import type { NoteMetadata } from "../../shared/schemas/notes.js";
import { buildNoteMetadata } from "./note-metadata.js";
import type { WorkspacePathGuard } from "./path-guard.js";

/*
 * NoteRepository (MasterPrompt.md 4.2, REQ-005): recursive discovery under
 * the active notes root with bounded concurrency; skips symlinks/junctions,
 * unsupported extensions, Local-Notes temp artifacts, and unreadable paths
 * without aborting. Filesystem stays the source of truth - the metadata
 * cache (2.8) only accelerates warm scans.
 */
const SCAN_CONCURRENCY = 16;
const SUPPORTED = new Set([".md", ".txt"]);
const TEMP_PREFIX = ".local-notes-tmp-";

interface FileTask {
  absPath: string;
  relPosix: string;
}

async function collectFiles(
  rootAbs: string,
  relPrefix: string,
  files: FileTask[],
  folders: string[],
): Promise<void> {
  const entries = await readdir(join(rootAbs, relPrefix), { withFileTypes: true }).catch(() => []);
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
    files.push({ absPath: join(rootAbs, rel), relPosix: rel.replaceAll("\\", "/") });
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

  /*
   * Cold scan hashes every file; warm scan (2.8 reconcile) reuses a prior
   * entry when path + size + mtime match, hashing only changed/new files.
   * Deleted files drop out naturally (walk only sees the live tree).
   */
  async scan(warmFrom?: readonly NoteMetadata[]): Promise<NoteMetadata[]> {
    const rootAbs = await this.notesRootAbs();
    const files: FileTask[] = [];
    await collectFiles(rootAbs, "", files, []);
    const cached = new Map((warmFrom ?? []).map((entry) => [entry.relativePath, entry]));

    const results: NoteMetadata[] = [];
    for (let index = 0; index < files.length; index += SCAN_CONCURRENCY) {
      const batch = files.slice(index, index + SCAN_CONCURRENCY);
      const settled = await Promise.all(
        batch.map((task) => buildNoteMetadata(task.absPath, task.relPosix, cached.get(task.relPosix))),
      );
      for (const entry of settled) if (entry) results.push(entry);
    }
    return results;
  }

  async listFolders(): Promise<string[]> {
    const rootAbs = await this.notesRootAbs();
    const folders: string[] = [];
    await collectFiles(rootAbs, "", [], folders);
    return folders.map((folder) => folder.replaceAll("\\", "/")).sort();
  }
}
