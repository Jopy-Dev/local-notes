import { z } from "zod";

/*
 * Search contracts (MasterPrompt.md 4.3 + 5.2). Results page in fixed batches
 * of 200; snippet capped at 180 chars; match ranges returned separately so the
 * client renders <mark> without re-scanning.
 */
export const SEARCH_BATCH_SIZE = 200;
export const SNIPPET_MAX_CHARS = 180;
export const CONTENT_INDEX_CAP_BYTES = 5 * 1024 * 1024;
export const CONTENT_BUDGET_BYTES = 512 * 1024 * 1024;

export const searchQuerySchema = z.object({
  q: z.string().min(1).max(512),
  offset: z.coerce
    .number()
    .int()
    .nonnegative()
    .multipleOf(SEARCH_BATCH_SIZE)
    .default(0),
});

export const contentIndexStatusSchema = z.enum(["full", "metadata-only"]);
export type ContentIndexStatus = z.infer<typeof contentIndexStatusSchema>;

export const searchResultSchema = z.object({
  noteKey: z.string().min(1),
  title: z.string(),
  relativePath: z.string().min(1),
  folder: z.string(),
  extension: z.enum([".md", ".txt"]),
  modifiedAt: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  snippet: z.string().max(SNIPPET_MAX_CHARS),
  matchRanges: z.array(z.tuple([z.number().int().nonnegative(), z.number().int().positive()])),
  contentIndexStatus: contentIndexStatusSchema,
  truncated: z.boolean(),
});
export type SearchResult = z.infer<typeof searchResultSchema>;

export const searchResponseSchema = z.object({
  results: z.array(searchResultSchema),
  total: z.number().int().nonnegative(),
  hasMore: z.boolean(),
});
export type SearchResponse = z.infer<typeof searchResponseSchema>;

export const indexStateSchema = z.enum(["unavailable", "building", "ready", "degraded"]);
export type IndexState = z.infer<typeof indexStateSchema>;

export const indexStatusSchema = z.object({
  state: indexStateSchema,
  indexedNotes: z.number().int().nonnegative(),
  metadataOnlyNotes: z.number().int().nonnegative(),
});
export type IndexStatus = z.infer<typeof indexStatusSchema>;
