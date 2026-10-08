import type { Token } from "marked";

/*
 * Inline copy-mark sources (REQ-036, round 10): a copy region copies exactly
 * what was typed between <copy> and </copy>. Inline marks stay on marked's
 * inline path as separate open/close html tokens, so the exact source is the
 * concatenated `raw` of the sibling tokens between them - marked's own parse,
 * never a parallel guess. Sources come back in opening-tag document order,
 * matching the order of the sanitized <copy> elements they annotate.
 */
const OPEN_TAG = /^<copy\b[^>]*>$/i;
const CLOSE_TAG = /^<\/copy\s*>$/i;

export const COPY_SOURCE_ATTR = "data-copy-source";

export function collectInlineCopySources(tokens: Token[]): string[] {
  const sources: string[] = [];
  scanSiblings(tokens, sources);
  return sources;
}

function scanSiblings(tokens: readonly Token[], sources: string[]): void {
  // Open marks in this sibling list: index into sources + collected raw.
  const open: { slot: number; raw: string }[] = [];
  for (const token of tokens) {
    const tag = token.type === "html" ? token.raw.trim() : "";
    if (OPEN_TAG.test(tag)) {
      open.forEach((mark) => (mark.raw += token.raw));
      open.push({ slot: sources.push("") - 1, raw: "" });
      continue;
    }
    if (CLOSE_TAG.test(tag) && open.length > 0) {
      const closed = open.pop();
      if (closed) sources[closed.slot] = closed.raw;
      open.forEach((mark) => (mark.raw += token.raw));
      continue;
    }
    open.forEach((mark) => (mark.raw += token.raw));
    for (const children of childLists(token)) scanSiblings(children, sources);
  }
  // Unclosed marks: the sanitizer closes them at the parent's end.
  for (const mark of open) sources[mark.slot] = mark.raw;
}

/* Child token lists in document order: inline children, list items, table
 * header cells, then table rows' cells. */
function childLists(token: Token): Token[][] {
  const record = token as unknown as Record<string, unknown>;
  const rows = Array.isArray(record.rows) ? (record.rows as unknown[]) : [];
  const holders = [record.items, record.header, ...rows].filter(Array.isArray).flat() as { tokens?: unknown }[];
  return [record.tokens, ...holders.map((holder) => holder.tokens)].filter(Array.isArray) as Token[][];
}

/* Attach each source to the matching bare <copy> element of sanitized html.
 * Sanitizing strips every attribute from note-authored <copy>, so a bare tag
 * is exactly one rendered inline mark. Any count mismatch (constructs marked
 * and the sanitizer resolve differently) annotates nothing - the client then
 * falls back to the rendered text instead of copying a misaligned source. */
export function annotateInlineCopySources(html: string, sources: readonly string[]): string {
  const bareTags = html.match(/<copy>/g)?.length ?? 0;
  if (bareTags === 0 || bareTags !== sources.length) return html;
  let index = 0;
  return html.replace(/<copy>/g, () => `<copy ${COPY_SOURCE_ATTR}="${escapeAttribute(sources[index++] ?? "")}">`);
}

export function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
