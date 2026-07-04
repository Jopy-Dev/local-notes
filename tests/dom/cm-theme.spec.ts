// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { markdown } from "@codemirror/lang-markdown";
import { highlightingFor } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { quietWorkbenchSyntaxHighlighting } from "../../src/frontend/editor/cm-theme.js";

/*
 * Markdown syntax colors in the source editor (Design_System.md 2.1/2.2):
 * accent owns "syntax heading" (# marks + heading text), text-code owns
 * code/syntax emphasis. Regression: markdown() alone left headings at the
 * plain source color because no project HighlightStyle was wired.
 */
function viewOf(doc: string) {
  return new EditorView({
    parent: document.body,
    state: EditorState.create({
      doc,
      extensions: [markdown(), quietWorkbenchSyntaxHighlighting],
    }),
  });
}

function styleRulesFor(cls: string): string {
  const css = Array.from(document.head.querySelectorAll("style"))
    .map((el) => el.textContent ?? "")
    .join("\n");
  const first = cls.split(" ")[0];
  const rule = css
    .split("}")
    .find((chunk) => chunk.includes(`.${first}`));
  return rule ?? "";
}

describe("quiet workbench markdown highlighting", () => {
  it("paints heading text and # marks with the accent token", () => {
    const view = viewOf("# Title");
    try {
      const headingCls = highlightingFor(view.state, [tags.heading]);
      const markCls = highlightingFor(view.state, [tags.processingInstruction]);
      expect(headingCls).toBeTruthy();
      expect(markCls).toBeTruthy();
      expect(styleRulesFor(headingCls!)).toContain("var(--color-accent)");
      expect(styleRulesFor(markCls!)).toContain("var(--color-accent)");
      const line = view.contentDOM.querySelector(".cm-line");
      const headingSpans = Array.from(
        line?.querySelectorAll(`span[class~="${headingCls!.split(" ")[0]}"]`) ?? [],
      );
      expect(headingSpans.map((span) => span.textContent).join("")).toContain("Title");
    } finally {
      view.destroy();
    }
  });

  it("paints inline code with the text-code token", () => {
    const view = viewOf("use `npm test` here");
    try {
      const codeCls = highlightingFor(view.state, [tags.monospace]);
      expect(codeCls).toBeTruthy();
      expect(styleRulesFor(codeCls!)).toContain("var(--color-text-code)");
    } finally {
      view.destroy();
    }
  });
});
