import { readFile } from "node:fs/promises";
import { AppError } from "../../shared/errors/codes.js";
import { OVERSIZED_LIMIT_BYTES } from "../../shared/schemas/notes.js";
import type { NoteDocument, NoteMetadata } from "../../shared/schemas/notes.js";
import { AtomicFileWriter } from "./atomic-writer.js";
import { buildNoteMetadata } from "./note-metadata.js";
import { decodeTextFile, encodeTextFile } from "./text-codec.js";
import { decodeNoteKey } from "./path-guard.js";
import type { WorkspacePathGuard } from "./path-guard.js";

/*
 * Note open/save (MasterPrompt.md 4.5, REQ-014/017/019): editor content is
 * LF-normalized; saves restore the original BOM + line-ending style through
 * the atomic writer with an expectedVersion recheck. Oversized and
 * unsupported-encoding notes are read-only - the file is never rewritten or
 * truncated on disk. The root defaults to the active notes tree; an archive
 * instance (round 2) reads the archive tree and is used read-only.
 */
const NOTES_REL_ROOT = "save-data/notes";

export class NoteContentService {
  private readonly writer = new AtomicFileWriter();

  constructor(
    private readonly guard: WorkspacePathGuard,
    private readonly rootRel: string = NOTES_REL_ROOT,
  ) {}

  async read(noteKey: string): Promise<NoteDocument> {
    const relPosix = decodeNoteKey(noteKey);
    const absPath = await this.guard.resolve(`${this.rootRel}/${relPosix}`);
    const metadata = await buildNoteMetadata(absPath, relPosix);
    if (!metadata) throw new AppError("NOTE_NOT_FOUND", "The note no longer exists on disk.");

    if (metadata.oversized) {
      // REQ-019: discoverable + read-only; content never loads into the editor.
      return this.toDocument(metadata, "", "utf8", "none");
    }
    const decoded = decodeTextFile(await readFile(absPath));
    return this.toDocument(metadata, decoded.content, decoded.textEncoding, decoded.lineEnding);
  }

  async write(noteKey: string, lfContent: string, expectedVersion: string): Promise<NoteMetadata> {
    const relPosix = decodeNoteKey(noteKey);
    const absPath = await this.guard.resolve(`${this.rootRel}/${relPosix}`, { forWrite: true });
    const currentBytes = await readFile(absPath).catch(() => {
      throw new AppError("NOTE_NOT_FOUND", "The note no longer exists on disk.");
    });

    if (currentBytes.length > OVERSIZED_LIMIT_BYTES) {
      throw new AppError("READ_ONLY_NOTE", "Oversized notes are read-only.");
    }
    const style = decodeTextFile(currentBytes);
    if (style.textEncoding === "unsupported") {
      throw new AppError("READ_ONLY_NOTE", "Unsupported-encoding notes are read-only.");
    }

    const bytes = encodeTextFile(lfContent, style);
    await this.writer.write({ absPath, relPath: relPosix, bytes, expectedVersion });
    const metadata = await buildNoteMetadata(absPath, relPosix);
    if (!metadata) throw new AppError("INTERNAL", "Saved note could not be read back.");
    return metadata;
  }

  private toDocument(
    metadata: NoteMetadata,
    content: string,
    textEncoding: NoteDocument["textEncoding"],
    lineEnding: NoteDocument["lineEnding"],
  ): NoteDocument {
    return { ...metadata, content, textEncoding, lineEnding };
  }
}
