import type { RankedEntry } from "./search-index.js";

/*
 * Post-rank tiers per REQ-009: exact title/filename -> partial title/filename
 * -> exact content phrase -> remaining partial/fuzzy matches. Ties break by
 * Orama score desc -> modified desc -> relative path asc.
 */
function tierOf(entry: RankedEntry, needle: string): number {
  const title = entry.metadata.title.toLocaleLowerCase();
  const filename = entry.metadata.filename.toLocaleLowerCase();
  const stem = filename.replace(/\.(md|txt)$/, "");
  if (title === needle || filename === needle || stem === needle) return 0;
  if (title.includes(needle) || filename.includes(needle)) return 1;
  if (entry.content.toLocaleLowerCase().includes(needle)) return 2;
  return 3;
}

export function rankEntries(entries: RankedEntry[], query: string): RankedEntry[] {
  const needle = query.trim().toLocaleLowerCase();
  return entries
    .map((entry) => ({ entry, tier: tierOf(entry, needle) }))
    .sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      if (a.entry.score !== b.entry.score) return b.entry.score - a.entry.score;
      const modified = b.entry.metadata.modifiedAt.localeCompare(a.entry.metadata.modifiedAt);
      if (modified !== 0) return modified;
      return a.entry.metadata.relativePath.localeCompare(b.entry.metadata.relativePath);
    })
    .map(({ entry }) => entry);
}
