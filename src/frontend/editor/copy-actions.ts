import { renderMarkdownPreview } from "../services/contentApi";

/*
 * Copy actions (MasterPrompt.md 4.7, REQ-020): Copy Markdown reads the
 * current draft; Copy Text reads the sanitized preview DOM's textContent so
 * Markdown syntax is stripped by the same pipeline the preview trusts.
 * Clipboard failure returns false for toast feedback - never a throw.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function plainTextFromHtml(html: string): string {
  // Server-sanitized HTML parsed detached; nothing executes (REQ-028).
  const parsed = new DOMParser().parseFromString(html, "text/html");
  // textContent alone runs blocks together; keep readable line structure.
  for (const block of Array.from(
    parsed.body.querySelectorAll("h1, h2, h3, h4, h5, h6, p, li, tr, blockquote, pre"),
  )) {
    block.after("\n");
  }
  const text = parsed.body.textContent ?? "";
  return text.replaceAll(/\n{3,}/g, "\n\n").trim();
}

export async function copyPlainText(
  draft: string,
  noteKey: string,
  extension: ".md" | ".txt",
): Promise<boolean> {
  if (extension === ".txt") return copyToClipboard(draft);
  try {
    const preview = await renderMarkdownPreview(draft, noteKey);
    return await copyToClipboard(plainTextFromHtml(preview.html));
  } catch {
    return false;
  }
}
