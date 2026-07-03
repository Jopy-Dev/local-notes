import { z } from "zod";
import { noteExtensionSchema } from "./notes.js";

/*
 * Mutation payloads (MasterPrompt.md 4.4 + 5.2). Move/archive carry the
 * client operation ID for watcher self-event suppression (4.5); create has
 * no suppression need - a fresh note cannot hold a dirty draft.
 */
export const createNoteSchema = z.object({
  filename: z.string().trim().min(1).max(120),
  extension: noteExtensionSchema,
  folderKey: z.string().max(512),
});
export type CreateNoteRequest = z.infer<typeof createNoteSchema>;

export const moveNoteSchema = z.object({
  destinationFolderKey: z.string().max(512),
  operationId: z.uuid(),
});
export type MoveNoteRequest = z.infer<typeof moveNoteSchema>;

export const archiveNoteSchema = z.object({
  replacementFilename: z.string().trim().min(1).max(120).optional(),
  operationId: z.uuid(),
});
export type ArchiveNoteRequest = z.infer<typeof archiveNoteSchema>;
