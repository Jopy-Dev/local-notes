import { randomUUID } from "node:crypto";

/*
 * Copyable regions lifted out before marked runs (REQ-036, round 2 + 3): any
 * region whose `<copy>` starts a line - alone (round-2 block form), with
 * content on the open line, or opening and closing on the same line - is a
 * block region. marked would otherwise treat the raw tag as paragraph HTML:
 * inner markdown renders literal (`##` stays text) and the sanitizer
 * auto-closes the unbalanced tag after the first block, so the copy element
 * loses everything past it (round-3 items 1+2). The pre-pass swaps each
 * region for a placeholder paragraph; the pipeline renders the inner content
 * through the full sanitizer separately and re-injects it as
 * `<copy data-block>`. A `<copy>` mid-line (text before the tag) stays on
 * marked's inline path. Regions inside fenced code blocks stay literal.
 */
export interface MultilineCopyBlock {
  token: string;
  content: string;
}

export interface CopyBlockExtraction {
  source: string;
  blocks: MultilineCopyBlock[];
}

const FENCE = /^(?:```|~~~)/;
const OPEN = "<copy>";
const CLOSE = "</copy>";

export function extractMultilineCopyBlocks(source: string): CopyBlockExtraction {
  const lines = source.split("\n");
  // Random run id: note content can never predict (and so never spoof) the
  // placeholder that gets swapped for the copy wrapper after sanitizing.
  const runId = randomUUID().slice(0, 8);
  const out: string[] = [];
  const blocks: MultilineCopyBlock[] = [];
  let inFence = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (FENCE.test(line.trimStart())) inFence = !inFence;
    const trimmed = line.trim();
    if (inFence || !trimmed.startsWith(OPEN)) {
      out.push(line);
      continue;
    }
    const openRest = trimmed.slice(OPEN.length);
    const content = regionContent(lines, index, openRest);
    if (content === null) {
      out.push(line);
      continue;
    }
    const token = `@@copyblock-${runId}-${blocks.length}@@`;
    blocks.push({ token, content: content.text });
    // Blank lines around the placeholder keep it its own paragraph.
    out.push("", token, "");
    index = content.closeIndex;
  }
  return { source: out.join("\n"), blocks };
}

/* Resolve a region opened at lines[openIndex]. openRest = text after the
 * open tag on that line. Returns null when the line is not a region: close
 * tag mid-line with trailing text (marked's inline path owns it) or no
 * closing line at all (stays literal). */
function regionContent(
  lines: string[],
  openIndex: number,
  openRest: string,
): { text: string; closeIndex: number } | null {
  const closeAt = openRest.indexOf(CLOSE);
  if (closeAt !== -1) {
    // Same-line form: only when the first close tag ends the line, so a
    // line carrying several inline marks keeps marked's inline rendering.
    if (closeAt + CLOSE.length !== openRest.length) return null;
    return { text: openRest.slice(0, closeAt), closeIndex: openIndex };
  }
  const close = findRegionClose(lines, openIndex + 1);
  if (close === null) return null;
  const middle = lines.slice(openIndex + 1, close.index);
  const parts = [...(openRest === "" ? [] : [openRest]), ...middle];
  if (close.prefix !== "") parts.push(close.prefix);
  return { text: parts.join("\n"), closeIndex: close.index };
}

/* First non-fenced line ending with the close tag. prefix = content before
 * the tag on that line (joins the region). A stray tag pair inside the
 * prefix disqualifies the region rather than guessing nesting. */
function findRegionClose(
  lines: string[],
  from: number,
): { index: number; prefix: string } | null {
  let inFence = false;
  for (let index = from; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (FENCE.test(line.trimStart())) inFence = !inFence;
    if (inFence) continue;
    const trimmed = line.trim();
    if (!trimmed.endsWith(CLOSE)) continue;
    const prefix = trimmed.slice(0, trimmed.length - CLOSE.length);
    if (prefix.includes(OPEN) || prefix.includes(CLOSE)) return null;
    return { index, prefix };
  }
  return null;
}

/* Swap a rendered placeholder for the wrapped block; the usual shape is its
 * own <p>, with a bare-token fallback for list/quote contexts. */
export function injectCopyBlock(html: string, token: string, wrapped: string): string {
  const paragraph = `<p>${token}</p>`;
  if (html.includes(paragraph)) return html.replace(paragraph, wrapped);
  return html.replace(token, wrapped);
}
