import { randomUUID } from "node:crypto";

/*
 * Multi-line copyable regions (REQ-036, round 2): a `<copy>` alone on its
 * own line, any markdown (including blank lines), then `</copy>` alone on
 * its own line. marked would treat that region as an opaque raw-HTML block
 * and skip the inner markdown, so the pre-pass lifts each region out behind
 * a placeholder paragraph; the pipeline renders the inner content through
 * the full sanitizer separately and re-injects it as `<copy data-block>`.
 * Single-line `<copy>text</copy>` never reaches this pass - marked handles
 * it inline. Regions inside fenced code blocks stay literal.
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
    if (inFence || line.trim() !== "<copy>") {
      out.push(line);
      continue;
    }
    const close = findClose(lines, index + 1);
    if (close === -1) {
      out.push(line);
      continue;
    }
    const token = `@@copyblock-${runId}-${blocks.length}@@`;
    blocks.push({ token, content: lines.slice(index + 1, close).join("\n") });
    // Blank lines around the placeholder keep it its own paragraph.
    out.push("", token, "");
    index = close;
  }
  return { source: out.join("\n"), blocks };
}

function findClose(lines: string[], from: number): number {
  let inFence = false;
  for (let index = from; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (FENCE.test(line.trimStart())) inFence = !inFence;
    if (!inFence && line.trim() === "</copy>") return index;
  }
  return -1;
}

/* Swap a rendered placeholder for the wrapped block; the usual shape is its
 * own <p>, with a bare-token fallback for list/quote contexts. */
export function injectCopyBlock(html: string, token: string, wrapped: string): string {
  const paragraph = `<p>${token}</p>`;
  if (html.includes(paragraph)) return html.replace(paragraph, wrapped);
  return html.replace(token, wrapped);
}
