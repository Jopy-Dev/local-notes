import { Marked } from "marked";
import sanitizeHtml from "sanitize-html";
import { extractMultilineCopyBlocks, injectCopyBlock } from "./copy-blocks.js";
import { classifyImage, classifyLink } from "./link-policy.js";

/*
 * Server-side Markdown render pipeline (MasterPrompt.md 4.6, REQ-028): marked
 * with GFM, then sanitize-html as the security boundary. Note content is data,
 * never code (7.2) - link/image re-classification lives in link-policy.ts and
 * only the sanitized output reaches the preview.
 */
// breaks: a source newline inside a paragraph renders as <br> so the preview
// follows the editor's line structure (REQ-014, feedback round 6). Copy Text
// parity: plainTextFromHtml turns <br> back into "\n".
const marked = new Marked({ gfm: true, breaks: true, async: false });

export interface RenderedMarkdown {
  html: string;
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
  return sanitizeHtml(raw, {
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
      a: (_tagName, attribs) => classifyLink(attribs.href, noteRelativePath),
      img: (_tagName, attribs) => {
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
}
