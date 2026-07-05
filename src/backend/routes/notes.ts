import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { API_PREFIX } from "../../shared/constants/server.js";
import { AppError } from "../../shared/errors/codes.js";
import type { NoteRepository } from "../filesystem/note-repository.js";
import { sortNotes } from "../filesystem/note-sort.js";

/*
 * Notes/folders read routes (MasterPrompt.md 5.2, REQ-005/008): metadata
 * pages of <=500 via opaque cursor; frontend appends + virtualizes. Folder
 * endpoint exposes the existing directory tree only.
 */
export const RECENT_WINDOW_DAYS = 7;
const RECENT_WINDOW_MS = RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000;

const listQuerySchema = z.object({
  cursor: z.string().regex(/^[A-Za-z0-9_-]+$/).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(500),
  sort: z.enum(["name", "created", "modified", "size"]).default("modified"),
  direction: z.enum(["asc", "desc"]).default("desc"),
  // Folder scope (WF-001): comparison-only against scanned metadata - never
  // a filesystem path, so no traversal surface. Unknown folder = empty page.
  folder: z.string().min(1).max(4096).optional(),
  // Recent scope (round 2): notes modified within the 7-day window.
  recent: z.enum(["true"]).optional(),
});

function isRecent(modifiedAt: string, cutoffMs: number): boolean {
  const parsed = Date.parse(modifiedAt);
  return Number.isFinite(parsed) && parsed >= cutoffMs;
}

function decodeCursor(cursor: string | undefined): number {
  if (!cursor) return 0;
  const offset = Number.parseInt(Buffer.from(cursor, "base64url").toString("utf8"), 10);
  if (!Number.isInteger(offset) || offset < 0) {
    throw new AppError("INVALID_QUERY", "Malformed cursor.");
  }
  return offset;
}

function encodeCursor(offset: number): string {
  return Buffer.from(String(offset), "utf8").toString("base64url");
}

export function registerNotesRoutes(
  app: FastifyInstance,
  options: { repository: NoteRepository },
): void {
  app.get(`${API_PREFIX}/notes`, async (request) => {
    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      throw new AppError("INVALID_QUERY", "Invalid list query parameters.");
    }
    const { cursor, limit, sort, direction, folder, recent } = parsed.data;
    const offset = decodeCursor(cursor);

    const scanned = await options.repository.scan();
    let scoped = folder
      ? scanned.filter(
          (note) => note.folder === folder || note.folder.startsWith(`${folder}/`),
        )
      : scanned;
    if (recent) {
      const cutoffMs = Date.now() - RECENT_WINDOW_MS;
      scoped = scoped.filter((note) => isRecent(note.modifiedAt, cutoffMs));
    }
    const all = sortNotes(scoped, sort, direction);
    const page = all.slice(offset, offset + limit);
    const nextOffset = offset + page.length;
    return {
      data: {
        notes: page,
        total: all.length,
        nextCursor: nextOffset < all.length ? encodeCursor(nextOffset) : null,
      },
      requestId: request.id,
    };
  });

  app.get(`${API_PREFIX}/folders`, async (request) => {
    // Direct-folder counts ride with the tree so the sidebar never derives
    // counts from a folder-scoped notes page (WF-001).
    const [folders, notes] = await Promise.all([
      options.repository.listFolders(),
      options.repository.scan(),
    ]);
    const counts: Record<string, number> = {};
    const cutoffMs = Date.now() - RECENT_WINDOW_MS;
    let recent = 0;
    for (const note of notes) {
      if (note.folder) counts[note.folder] = (counts[note.folder] ?? 0) + 1;
      if (isRecent(note.modifiedAt, cutoffMs)) recent += 1;
    }
    return { data: { folders, counts, total: notes.length, recent }, requestId: request.id };
  });
}
