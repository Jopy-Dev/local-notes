import { z } from "zod";

// Canonical note DTOs (MasterPrompt.md 2.3). noteKey opaque base64url of the
// normalized POSIX relative path; versionToken = sha256(bytes + relPath).
export const noteExtensionSchema = z.enum([".md", ".txt"]);
export type NoteExtension = z.infer<typeof noteExtensionSchema>;

export const noteMetadataSchema = z.object({
  noteKey: z.string().min(1),
  relativePath: z.string().min(1),
  filename: z.string().min(1),
  title: z.string(),
  extension: noteExtensionSchema,
  folder: z.string(),
  createdAt: z.string().nullable(),
  modifiedAt: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  versionToken: z.string().length(64),
  oversized: z.boolean(),
  preview: z.string().max(240),
});

export type NoteMetadata = z.infer<typeof noteMetadataSchema>;

export const OVERSIZED_LIMIT_BYTES = 5 * 1024 * 1024;
export const PREVIEW_MAX_CHARS = 240;
