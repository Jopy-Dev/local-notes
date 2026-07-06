import { SNIPPET_MAX_CHARS } from "../../shared/schemas/search.js";

/*
 * Snippet extraction per REQ-009: cap 180 chars, centered around the first
 * match; ranges are relative to the returned snippet so the client can render
 * <mark> without re-scanning text.
 */
export interface SnippetResult {
  snippet: string;
  matchRanges: Array<[number, number]>;
}

export function buildSnippet(content: string, query: string): SnippetResult {
  const needle = query.trim().toLocaleLowerCase();
  if (!content) return { snippet: "", matchRanges: [] };

  const haystack = content.toLocaleLowerCase();
  const firstMatch = needle ? haystack.indexOf(needle) : -1;

  let start = 0;
  if (firstMatch >= 0 && content.length > SNIPPET_MAX_CHARS) {
    const center = firstMatch + Math.floor(needle.length / 2);
    start = Math.max(0, Math.min(center - Math.floor(SNIPPET_MAX_CHARS / 2), content.length - SNIPPET_MAX_CHARS));
  }
  const snippet = content.slice(start, start + SNIPPET_MAX_CHARS);

  const matchRanges: Array<[number, number]> = [];
  if (needle) {
    const window = snippet.toLocaleLowerCase();
    let at = window.indexOf(needle);
    while (at >= 0) {
      matchRanges.push([at, at + needle.length]);
      at = window.indexOf(needle, at + needle.length);
    }
  }
  return { snippet, matchRanges };
}
