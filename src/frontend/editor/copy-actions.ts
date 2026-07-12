import { plainTextFromSource } from "./copy-text";

export { plainTextFromSource } from "./copy-text";

/*
 * Copy actions (MasterPrompt.md 4.7, REQ-020): Copy Markdown reads the
 * current draft minus the app's copy tags; Copy Text strips Markdown syntax
 * per source line, preserving the note's line structure (round 7).
 * Clipboard failure returns false for toast feedback - never a throw.
 */
const COPY_OPEN = "<copy>";
const COPY_CLOSE = "</copy>";
// Mirrors the render pre-pass fence rule (src/backend/markdown/copy-blocks.ts):
// fenced code keeps literal tags there too, so clipboard and preview agree.
const FENCE = /^(?:```|~~~)/;

/*
 * Copy Markdown output (REQ-020, round 6): the draft minus the app's
 * <copy>/</copy> markers. Marked regions keep their inner markdown; a line
 * that held only tags disappears; fenced code and inline code spans keep
 * literal tags because the preview renders them literal as well.
 */
export function markdownForClipboard(source: string): string {
  const lines = source.split("\n");
  const out: string[] = [];
  let inFence = false;
  for (const line of lines) {
    if (FENCE.test(line.trimStart())) inFence = !inFence;
    if (inFence || !(line.includes(COPY_OPEN) || line.includes(COPY_CLOSE))) {
      out.push(line);
      continue;
    }
    const stripped = stripTagsOutsideInlineCode(line);
    // A line that carried nothing but tags (plus whitespace) drops entirely.
    if (stripped.trim() === "") continue;
    out.push(stripped);
  }
  return out.join("\n");
}

function stripTagsOutsideInlineCode(line: string): string {
  // Odd split indexes are captured backtick spans - left untouched.
  return line
    .split(/(`+[^`]*`+)/)
    .map((part, index) =>
      index % 2 === 1 ? part : part.replaceAll(COPY_OPEN, "").replaceAll(COPY_CLOSE, ""),
    )
    .join("");
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export async function copyPlainText(
  draft: string,
  _noteKey: string,
  extension: ".md" | ".txt",
): Promise<boolean> {
  if (extension === ".txt") return copyToClipboard(draft);
  return copyToClipboard(plainTextFromSource(draft));
}
