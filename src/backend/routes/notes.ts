import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { API_PREFIX } from "../../shared/constants/server.js";
import { AppError } from "../../shared/errors/codes.js";
import type { NoteRepository } from "../filesystem/note-repository.js";
import { sortNotes } from "../filesystem/note-sort.js";

/*
 * Notes/folders read routes (MasterPrompt.md 5.2, REQ-005/007/008): metadata
 * pages of <=500 via opaque cursor; frontend appends + virtualizes. Folder
 * endpoint exposes the existing directory tree only.
 */
const listQuerySchema = z.object({
  cursor: z.string().regex(/^[A-Za-z0-9_-]+$/).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(500),
  sort: z.enum(["name", "created", "modified", "size"]).default("modified"),
  direction: z.enum(["asc", "desc"]).default("desc"),
});

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
    const { cursor, limit, sort, direction } = parsed.data;
    const offset = decodeCursor(cursor);

    const all = sortNotes(await options.repository.scan(), sort, direction);
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
    return { data: { folders: await options.repository.listFolders() }, requestId: request.id };
  });
}
