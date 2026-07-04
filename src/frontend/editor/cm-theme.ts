import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";

/*
 * Quiet Workbench CodeMirror theme (Design_System.md 3/9.2): tokens map
 * through CSS variables - no raw colors here (they resolve from the
 * Tailwind theme at runtime).
 */
export const quietWorkbenchTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "var(--color-surface-code)",
      color: "var(--color-text-source)",
      height: "100%",
      // REQ-021 editor appearance settings; fallbacks match pre-settings look.
      fontSize: "var(--editor-font-size, 13px)",
    },
    ".cm-content": {
      fontFamily: "var(--font-mono)",
      lineHeight: "var(--editor-line-height, 1.7)",
      caretColor: "var(--color-focus)",
      maxWidth: "var(--editor-max-width, 76ch)",
      paddingBottom: "5rem",
    },
    ".cm-gutters": {
      backgroundColor: "var(--color-surface-code)",
      color: "var(--color-text-disabled)",
      border: "none",
    },
    "&.cm-focused": { outline: "none" },
    ".cm-cursor": { borderLeftColor: "var(--color-focus)" },
    ".cm-activeLine": { backgroundColor: "transparent" },
    ".cm-activeLineGutter": {
      backgroundColor: "transparent",
      color: "var(--color-text-muted)",
    },
    ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
      backgroundColor: "var(--color-surface-selected)",
    },
  },
  { dark: true },
);

/*
 * Markdown token colors (Design_System.md 2.1/2.2): accent = "syntax
 * heading" (heading text + hash/star mark punctuation), text-code = code/syntax
 * emphasis. Without this, basicSetup's defaultHighlightStyle fallback
 * leaves headings bold-only and paints marks with light-theme literals.
 */
const quietWorkbenchHighlightStyle = HighlightStyle.define([
  { tag: tags.heading, color: "var(--color-accent)", fontWeight: "650" },
  { tag: tags.processingInstruction, color: "var(--color-accent)" },
  { tag: tags.strong, fontWeight: "700" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  { tag: tags.monospace, color: "var(--color-text-code)" },
  {
    tag: tags.link,
    color: "var(--color-accent)",
    textDecoration: "underline",
    textUnderlineOffset: "2px",
  },
  { tag: tags.url, color: "var(--color-text-code)" },
  { tag: tags.quote, color: "var(--color-text-muted)", fontStyle: "italic" },
  { tag: tags.contentSeparator, color: "var(--color-border-active)" },
]);

export const quietWorkbenchSyntaxHighlighting = syntaxHighlighting(quietWorkbenchHighlightStyle);
