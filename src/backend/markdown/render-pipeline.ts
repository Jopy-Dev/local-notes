import { posix } from "node:path";
import { Marked } from "marked";
import sanitizeHtml from "sanitize-html";
import { encodeNoteKey } from "../filesystem/path-guard.js";
import { extractMultilineCopyBlocks, injectCopyBlock } from "./copy-blocks.js";

/*
 * Server-side Markdown render pipeline (MasterPrompt.md 4.6, REQ-028): marked
 * with GFM, then sanitize-html as the security boundary. Note content is data,
 * never code (7.2) - every link and image is re-classified here regardless of
 * what the source claims, and only the sanitized output reaches the preview.
 */
const NOTE_EXTENSIONS = new Set([".md", ".txt"]);
const ASSET_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".bmp", ".ico"]);
const HAS_SCHEME = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

const marked = new Marked({ gfm: true, async: false });

export interface RenderedMarkdown {
  html: string;
}

/*
 * Resolve a note-relative reference inside the save-data namespace. Returns
 * the save-data-relative POSIX path, or null when the target escapes it.
 * noteRelativePath is notes-root-relative, so references resolve against
 * "notes/<note folder>" (MasterPrompt.md 2.2).
 */
function resolveWorkspaceRelative(reference: string, noteRelativePath: string): string | null {
  const decoded = safeDecode(reference);
  if (decoded === null || decoded.includes("\0") || decoded.startsWith("/") || decoded.startsWith("\\")) {
    return null;
  }
  const baseDir = posix.join("notes", posix.dirname(noteRelativePath));
  const resolved = posix.normalize(posix.join(baseDir, decoded.replaceAll("\\", "/")));
  if (resolved.startsWith("..") || posix.isAbsolute(resolved)) return null;
  return resolved;
}

function safeDecode(reference: string): string | null {
  try {
    return decodeURIComponent(reference);
  } catch {
    return null;
  }
}

function classifyLink(
  href: string | undefined,
  noteRelativePath: string,
): { tagName: string; attribs: Record<string, string> } {
  if (!href) return { tagName: "span", attribs: { "data-blocked": "link" } };
  if (href.startsWith("#")) return { tagName: "a", attribs: { href, "data-link": "fragment" } };
  if (HAS_SCHEME.test(href)) {
    if (/^https?:/i.test(href)) {
      // External links need explicit confirmation client-side (REQ-014).
      return { tagName: "a", attribs: { href, rel: "noreferrer", "data-link": "external" } };
    }
    return { tagName: "span", attribs: { "data-blocked": "link" } };
  }
  const resolved = resolveWorkspaceRelative(href, noteRelativePath);
  if (!resolved || !resolved.startsWith("notes/")) {
    return { tagName: "span", attribs: { "data-blocked": "link" } };
  }
  const extension = posix.extname(resolved).toLowerCase();
  if (!NOTE_EXTENSIONS.has(extension)) {
    return { tagName: "span", attribs: { "data-blocked": "link" } };
  }
  const notesRelative = resolved.slice("notes/".length);
  return {
    tagName: "a",
    attribs: { href: `/notes/${encodeNoteKey(notesRelative)}`, "data-link": "internal" },
  };
}

function classifyImage(
  src: string | undefined,
  alt: string | undefined,
  noteRelativePath: string,
): { tagName: string; attribs: Record<string, string>; text?: string } {
  const blocked = {
    tagName: "span",
    attribs: { "data-blocked": "image" },
    text: alt ? `Blocked image: ${alt}` : "Blocked image",
  };
  if (!src || HAS_SCHEME.test(src) || src.startsWith("//")) return blocked;
  const resolved = resolveWorkspaceRelative(src, noteRelativePath);
  if (!resolved || !ASSET_EXTENSIONS.has(posix.extname(resolved).toLowerCase())) return blocked;
  return {
    tagName: "img",
    attribs: { src: `/api/v1/assets/${encodeNoteKey(resolved)}`, alt: alt ?? "" },
  };
}

export function renderMarkdown(source: string, noteRelativePath: string): RenderedMarkdown {
  // Multi-line <copy> regions (round 2): render each region's markdown
  // through this same pipeline, then re-wrap. The wrapper is a literal and
  // the inner html has already passed the sanitizer below, so the boundary
  // holds; data-block is injected after sanitizing, never accepted from
  // note content.
  const extraction = extractMultilineCopyBlocks(source);
  let html = renderSanitized(extraction.source, noteRelativePath);
  for (const block of extraction.blocks) {
    const inner = renderSanitized(block.content, noteRelativePath);
    html = injectCopyBlock(html, block.token, `<copy data-block="">${inner}</copy>`);
  }
  return { html };
}

function renderSanitized(source: string, noteRelativePath: string): string {
  const raw = marked.parse(source) as string;
  const html = sanitizeHtml(raw, {
    allowedTags: [
      "h1", "h2", "h3", "h4", "h5", "h6",
      "p", "br", "hr", "blockquote", "pre", "code",
      "strong", "em", "del", "s", "u", "copy", "span",
      "ul", "ol", "li", "input",
      "table", "thead", "tbody", "tr", "th", "td",
      "a", "img",
    ],
    allowedAttributes: {
      a: ["href", "rel", "data-link"],
      img: ["src", "alt"],
      input: ["type", "checked", "disabled"],
      ol: ["start"],
      th: ["align"],
      td: ["align"],
      span: ["data-blocked"],
    },
    // Relative note/asset hrefs are rewritten before this filter; only
    // classified externals keep an absolute scheme.
    allowedSchemes: ["http", "https"],
    allowProtocolRelative: false,
    transformTags: {
      a: (tagName, attribs) => classifyLink(attribs.href, noteRelativePath),
      img: (tagName, attribs) => {
        const result = classifyImage(attribs.src, attribs.alt, noteRelativePath);
        return result.text === undefined
          ? { tagName: result.tagName, attribs: result.attribs }
          : { tagName: result.tagName, attribs: result.attribs, text: result.text };
      },
      // Task-list checkboxes are the only input allowed; force them inert.
      input: (_tagName, attribs) => ({
        tagName: "input",
        attribs:
          attribs.checked === undefined
            ? { type: "checkbox", disabled: "disabled" }
            : { type: "checkbox", disabled: "disabled", checked: "" },
      }),
    },
  });
  return html;
}
