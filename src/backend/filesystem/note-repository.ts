import type { NoteMetadata } from "../../shared/schemas/notes.js";
import { buildNoteMetadata } from "./note-metadata.js";
import { walkNotesTree } from "./note-walk.js";
import type { WorkspacePathGuard } from "./path-guard.js";

/*
 * NoteRepository (MasterPrompt.md 4.2, REQ-005): discovery facade over the
 * notes-tree walk + metadata builder. Filesystem stays the source of truth -
 * the metadata cache (2.8) only accelerates warm scans.
 */
const SCAN_CONCURRENCY = 16;

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
    const { files } = await walkNotesTree(await this.notesRootAbs());
    const cached = new Map((warmFrom ?? []).map((entry) => [entry.relativePath, entry]));

    const results: NoteMetadata[] = [];
    for (let index = 0; index < files.length; index += SCAN_CONCURRENCY) {
      const batch = files.slice(index, index + SCAN_CONCURRENCY);
      const settled = await Promise.all(
        batch.map((task) =>
          buildNoteMetadata(task.absPath, task.relPosix, cached.get(task.relPosix)),
        ),
      );
      for (const entry of settled) if (entry) results.push(entry);
    }
    return results;
  }

  async listFolders(): Promise<string[]> {
    const { folders } = await walkNotesTree(await this.notesRootAbs());
    return folders;
  }
}
