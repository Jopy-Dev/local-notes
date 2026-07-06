/*
 * Find-in-note scan (MasterPrompt.md 4.11, REQ-035): pure text scan shared
 * by every editor surface (CodeMirror source, rendered preview).
 * Case-insensitive by default, query always literal. Highlight ranges cap
 * at 500 to bound render cost on pathological repetitive content; total
 * match count stays accurate beyond the cap.
 */
export const FIND_HIGHLIGHT_CAP = 500;

export interface FindRequest {
  query: string;
  activeIndex: number;
  caseSensitive: boolean;
}

export interface FindRange {
  from: number;
  to: number;
}

export interface FindScan {
  ranges: FindRange[];
  total: number;
}

const EMPTY_SCAN: FindScan = { ranges: [], total: 0 };

function escapeRegExp(query: string): string {
  return query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function scanMatches(text: string, query: string, caseSensitive = false): FindScan {
  if (query.trim() === "" || text === "") return { ...EMPTY_SCAN, ranges: [] };
  const pattern = new RegExp(escapeRegExp(query), caseSensitive ? "g" : "gi");
  const ranges: FindRange[] = [];
  let total = 0;
  for (const match of text.matchAll(pattern)) {
    total += 1;
    if (ranges.length < FIND_HIGHLIGHT_CAP) {
      ranges.push({ from: match.index, to: match.index + match[0].length });
    }
  }
  return { ranges, total };
}
