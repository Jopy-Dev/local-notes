import { Lexer } from "marked";
import type { Token } from "marked";

/*
 * Static source-only construct scan (MasterPrompt.md 4.6 step 2). Shared by
 * the render route (server verdict) and the frontend compatibility service,
 * which may still downgrade "edit" after the TipTap round-trip check. Uses
 * the marked lexer so constructs inside code fences/spans never trigger.
 */
export interface CompatibilityScan {
  compatibility: "edit" | "source-only";
  compatibilityReason: string | null;
}

const EDIT: CompatibilityScan = { compatibility: "edit", compatibilityReason: null };

// <u>/<copy> are the only raw HTML allowed in saved Markdown, attribute-less
// (REQ-015/REQ-036); everything else, including comments, forces source-only.
const ALLOWED_RAW_TAG = /^<\/?(?:u|copy)>$/;
const HTML_TAG_OR_COMMENT = /<!--|<\/?[a-zA-Z][^>]*>/g;
const FRONTMATTER = new RegExp("^\\uFEFF?(?:---|\\+\\+\\+)\\r?\\n");
const FOOTNOTE = /\[\^[^\]\s]+\]/;

function sourceOnly(reason: string): CompatibilityScan {
  return { compatibility: "source-only", compatibilityReason: reason };
}

function rawHtmlReason(raw: string): string | null {
  if (raw.includes("<!--")) return "HTML comments are not supported in visual editing.";
  const disallowed = (raw.match(HTML_TAG_OR_COMMENT) ?? []).some((tag) => !ALLOWED_RAW_TAG.test(tag));
  return disallowed ? "Raw HTML other than <u> and <copy> is not supported in visual editing." : null;
}

function tokenReason(token: Token): string | null {
  switch (token.type) {
    case "html":
      return rawHtmlReason("raw" in token ? token.raw : "");
    case "def":
      return "Reference definitions are not supported in visual editing.";
    case "text":
    case "paragraph":
      return FOOTNOTE.test(token.raw) ? "Footnotes are not supported in visual editing." : null;
    default:
      return null;
  }
}

function scanTokens(tokens: Token[]): string | null {
  for (const token of tokens) {
    if (token.type === "code" || token.type === "codespan") continue;
    const reason = tokenReason(token);
    if (reason) return reason;
    const children = "tokens" in token ? token.tokens : undefined;
    const nested = children ? scanTokens(children) : null;
    if (nested) return nested;
  }
  return null;
}

export function scanSourceOnlyConstructs(source: string): CompatibilityScan {
  if (FRONTMATTER.test(source)) {
    return sourceOnly("Frontmatter is not supported in visual editing.");
  }
  let tokens: Token[];
  try {
    tokens = new Lexer({ gfm: true }).lex(source);
  } catch {
    return sourceOnly("Markdown could not be parsed for visual editing.");
  }
  const reason = scanTokens(tokens);
  return reason ? sourceOnly(reason) : EDIT;
}
