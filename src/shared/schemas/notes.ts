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

/*
 * NoteDocument (MasterPrompt.md 2.3): metadata + editor-facing content.
 * markdownCompatibility stays "source-only" until the Wave 6 visual-editor
 * compatibility service lands; unsupported encoding is read-only and never
 * enters the save pipeline.
 */
export const noteDocumentSchema = noteMetadataSchema.extend({
  content: z.string(),
  markdownCompatibility: z.enum(["edit", "source-only"]),
  compatibilityReason: z.string().nullable(),
  textEncoding: z.enum(["utf8", "utf8-bom", "unsupported"]),
  lineEnding: z.enum(["lf", "crlf", "none"]),
});

export type NoteDocument = z.infer<typeof noteDocumentSchema>;
