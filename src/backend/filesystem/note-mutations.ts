import { mkdir, open, readdir, rename, stat } from "node:fs/promises";
import { basename, dirname } from "node:path";
import { AppError } from "../../shared/errors/codes.js";
import type { NoteExtension, NoteMetadata } from "../../shared/schemas/notes.js";
import { buildNoteMetadata } from "./note-metadata.js";
import { decodeNoteKey, encodeNoteKey, validateNoteFilename } from "./path-guard.js";
import type { WorkspacePathGuard } from "./path-guard.js";

/*
 * Create/move/archive (MasterPrompt.md 4.4, REQ-011/012/013): exclusive
 * creation, Unicode case-folded collision checks against real directory
 * entries, archive preserves the relative source structure. No overwrite,
 * no auto-suffix, no permanent delete; failed operations leave both sides
 * untouched. Same-path mutexes acquire in lexical order (2.5) so concurrent
 * move/archive pairs cannot deadlock.
 */
const NOTES_REL_ROOT = "save-data/notes";
const ARCHIVE_REL_ROOT = "save-data/archive";

function caseFold(name: string): string {
  return name.normalize("NFC").toLocaleLowerCase();
}

async function hasCaseFoldEntry(dirAbs: string, filename: string): Promise<boolean> {
  const target = caseFold(filename);
  const entries = await readdir(dirAbs).catch(() => []);
  return entries.some((entry) => caseFold(entry) === target);
}

export interface CreateNoteInput {
  filename: string;
  extension: NoteExtension;
  folderKey: string;
}

export class NoteMutationService {
  // Lexically-ordered path mutex (2.5): serializes mutations touching the
  // same source/destination without deadlocking crossed pairs.
  private readonly locks = new Map<string, Promise<unknown>>();

  constructor(private readonly guard: WorkspacePathGuard) {}

  async create(input: CreateNoteInput): Promise<NoteMetadata> {
    const trimmed = input.filename.trim();
    const fullName = trimmed.toLocaleLowerCase().endsWith(input.extension)
      ? trimmed
      : `${trimmed}${input.extension}`;
    this.assertValidFilename(fullName);

    const folderRel = normalizeFolderKey(input.folderKey);
    const folderAbs = await this.resolveExistingFolder(`${NOTES_REL_ROOT}${folderRel ? `/${folderRel}` : ""}`);
    const relPosix = folderRel ? `${folderRel}/${fullName}` : fullName;

    return this.withLocks([relPosix], async () => {
      if (await hasCaseFoldEntry(folderAbs, fullName)) {
        throw new AppError("NOTE_EXISTS", "A note with this name already exists in the folder.");
      }
      const absPath = await this.guard.resolve(`${NOTES_REL_ROOT}/${relPosix}`, { forWrite: true });
      // Exclusive create: empty UTF-8 file, LF by absence of content (REQ-011).
      const handle = await open(absPath, "wx", 0o600).catch((error: NodeJS.ErrnoException) => {
        if (error.code === "EEXIST") {
          throw new AppError("NOTE_EXISTS", "A note with this name already exists in the folder.");
        }
        throw error;
      });
      await handle.close();
      const metadata = await buildNoteMetadata(absPath, relPosix);
      if (!metadata) throw new AppError("INTERNAL", "Created note could not be read back.");
      return metadata;
    });
  }

  async move(noteKey: string, destinationFolderKey: string): Promise<NoteMetadata> {
    const sourceRel = decodeNoteKey(noteKey);
    const filename = basename(sourceRel);
    const folderRel = normalizeFolderKey(destinationFolderKey);
    const destDirAbs = await this.resolveExistingFolder(
      `${NOTES_REL_ROOT}${folderRel ? `/${folderRel}` : ""}`,
    );
    const destRel = folderRel ? `${folderRel}/${filename}` : filename;
    if (destRel === sourceRel) {
      return this.metadataFor(sourceRel);
    }

    return this.withLocks([sourceRel, destRel], async () => {
      const sourceAbs = await this.guard.resolve(`${NOTES_REL_ROOT}/${sourceRel}`, { forWrite: true });
      await this.assertSourceNote(sourceAbs);
      if (await hasCaseFoldEntry(destDirAbs, filename)) {
        throw new AppError("NOTE_EXISTS", "A note with this name already exists in the folder.");
      }
      const destAbs = await this.guard.resolve(`${NOTES_REL_ROOT}/${destRel}`, { forWrite: true });
      await rename(sourceAbs, destAbs);
      return this.metadataFor(destRel);
    });
  }

  async archive(noteKey: string, replacementFilename?: string): Promise<{ archivedRelativePath: string }> {
    const sourceRel = decodeNoteKey(noteKey);
    const sourceDir = dirname(sourceRel) === "." ? "" : dirname(sourceRel);
    let filename = basename(sourceRel);
    if (replacementFilename !== undefined) {
      this.assertValidFilename(replacementFilename);
      filename = replacementFilename;
    }
    const archivedRel = sourceDir ? `${sourceDir}/${filename}` : filename;

    return this.withLocks([sourceRel, `archive:${archivedRel}`], async () => {
      const sourceAbs = await this.guard.resolve(`${NOTES_REL_ROOT}/${sourceRel}`, { forWrite: true });
      await this.assertSourceNote(sourceAbs);
      const destAbs = await this.guard.resolve(`${ARCHIVE_REL_ROOT}/${archivedRel}`, { forWrite: true });
      // Archive preserves relative structure (REQ-013); parents may not exist yet.
      await mkdir(dirname(destAbs), { recursive: true });
      if (await hasCaseFoldEntry(dirname(destAbs), filename)) {
        throw new AppError("ARCHIVE_COLLISION", "An archived note with this name already exists.");
      }
      await rename(sourceAbs, destAbs);
      return { archivedRelativePath: archivedRel };
    });
  }

  private assertValidFilename(fullName: string): void {
    const verdict = validateNoteFilename(fullName);
    if (!verdict.ok) {
      throw new AppError("INVALID_FILENAME", verdict.reason, { filename: [verdict.reason] });
    }
  }

  private async resolveExistingFolder(rel: string): Promise<string> {
    const abs = await this.guard.resolve(rel);
    const stats = await stat(abs).catch(() => null);
    if (!stats?.isDirectory()) {
      throw new AppError("FOLDER_NOT_FOUND", "Destination folder does not exist.");
    }
    return abs;
  }

  private async assertSourceNote(sourceAbs: string): Promise<void> {
    const stats = await stat(sourceAbs).catch(() => null);
    if (!stats?.isFile()) {
      throw new AppError("NOTE_NOT_FOUND", "The note no longer exists on disk.");
    }
  }

  private async metadataFor(relPosix: string): Promise<NoteMetadata> {
    const absPath = await this.guard.resolve(`${NOTES_REL_ROOT}/${relPosix}`);
    const metadata = await buildNoteMetadata(absPath, relPosix);
    if (!metadata) throw new AppError("INTERNAL", "Note metadata could not be read.");
    return metadata;
  }

  private async withLocks<T>(keys: string[], task: () => Promise<T>): Promise<T> {
    const ordered = [...new Set(keys)].sort();
    const release: Array<() => void> = [];
    for (const key of ordered) {
      const previous = this.locks.get(key) ?? Promise.resolve();
      let unlock!: () => void;
      const gate = new Promise<void>((resolve) => {
        unlock = resolve;
      });
      this.locks.set(key, previous.then(() => gate));
      await previous.catch(() => undefined);
      release.push(unlock);
    }
    try {
      return await task();
    } finally {
      for (const unlock of release) unlock();
    }
  }
}

function normalizeFolderKey(folderKey: string): string {
  const trimmed = folderKey.trim().replace(/^\/+|\/+$/g, "");
  return trimmed;
}

export { encodeNoteKey };
