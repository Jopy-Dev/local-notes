import { EditorView, MatchDecorator, Decoration, ViewPlugin } from "@codemirror/view";
import type { DecorationSet, ViewUpdate } from "@codemirror/view";
import type { Extension } from "@codemirror/state";

/*
 * Copy-tag highlight (user feedback round 4): literal <copy> / </copy> tags
 * get a dedicated color in Markdown source so regions stand out while
 * scanning. Pure view decoration over the live document - never an edit.
 * Wired next to markdown() in SourceEditor's language compartment, so plain
 * .txt notes (which never interpret <copy>, REQ-036) stay unstyled.
 */
const copyTagMatcher = new MatchDecorator({
  regexp: /<\/?copy>/g,
  decoration: Decoration.mark({ class: "cm-copyTag" }),
});

const copyTagPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = copyTagMatcher.createDeco(view);
    }

    update(update: ViewUpdate) {
      this.decorations = copyTagMatcher.updateDeco(update, this.decorations);
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

// User-picked marker color (2026-07-06); one value for both themes via the
// --color-copy-tag token in app.css.
const copyTagTheme = EditorView.baseTheme({
  ".cm-copyTag": { color: "var(--color-copy-tag)" },
});

export function copyTagHighlight(): Extension {
  return [copyTagPlugin, copyTagTheme];
}
