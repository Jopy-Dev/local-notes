/*
 * Copy Text source transform (REQ-020, round 7): strip Markdown syntax per
 * line while preserving the note's exact line and blank-line structure -
 * blank lines appear in the copy only where the source has them. The preview
 * DOM cannot provide this (a heading directly followed by text and a heading
 * with a blank line between render identical HTML), so Copy Text reads the
 * draft, not the rendered document.
 */

const FENCE = /^(?:```|~~~)/;
// Only dashes/equals/asterisks (hr or setext underline) or table separator
// cells - these lines are pure syntax and disappear from the copy.
const RULE_LINE = /^\s*(?:-{3,}|={3,}|\*{3,})\s*$/;
const TABLE_SEPARATOR = /^\s*\|?[\s:|-]+\|?\s*$/;

export function plainTextFromSource(source: string): string {
  const lines = source.split("\n");
  const out: string[] = [];
  let inFence = false;
  for (const line of lines) {
    if (FENCE.test(line.trimStart())) {
      inFence = !inFence;
      continue; // fence delimiters are syntax; fenced content stays literal
    }
    if (inFence) {
      out.push(line.replace(/\s+$/, ""));
      continue;
    }
    if (RULE_LINE.test(line) || (line.includes("|") && TABLE_SEPARATOR.test(line))) continue;
    out.push(stripInlineSyntax(stripLineSyntax(line)).replace(/\s+$/, ""));
  }
  return out.join("\n");
}

/* Line-leading block syntax: quote markers, then EITHER heading hashes OR a
 * list marker - exclusive, so heading text like "1. Accounts" is not re-eaten
 * as a numbered-list marker. */
function stripLineSyntax(line: string): string {
  const text = line.replace(/^(\s*>\s?)+/, "");
  const heading = text.replace(/^\s*#{1,6}\s+/, "");
  if (heading !== text) return heading;
  return text.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, "").replace(/^\[[ xX]\]\s+/, "");
}

function stripInlineSyntax(line: string): string {
  let text = line;
  // Table rows: pipes become single-space cell joins.
  if (/^\s*\|.*\|\s*$/.test(text)) {
    text = text
      .split("|")
      .map((cell) => cell.trim())
      .filter((cell) => cell !== "")
      .join(" ");
  }
  // Copy tags outside inline code, then unwrap the code spans themselves so
  // a literal `<copy>` inside backticks survives as text.
  text = text
    .split(/(`+[^`]*`+)/)
    .map((part, index) =>
      index % 2 === 1 ? part : part.replaceAll("<copy>", "").replaceAll("</copy>", ""),
    )
    .join("");
  text = text.replace(/`+([^`]*)`+/g, "$1");
  // Images before links (shared bracket shape); keep alt/link text.
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  // Emphasis pairs only - unmatched markers stay literal text.
  text = text.replace(/\*\*([^*]+)\*\*/g, "$1");
  text = text.replace(/__([^_]+)__/g, "$1");
  text = text.replace(/~~([^~]+)~~/g, "$1");
  text = text.replace(/(^|\W)\*([^*\s][^*]*)\*(?=\W|$)/g, "$1$2");
  text = text.replace(/(^|\W)_([^_\s][^_]*)_(?=\W|$)/g, "$1$2");
  text = text.replaceAll("<u>", "").replaceAll("</u>", "");
  return text;
}
