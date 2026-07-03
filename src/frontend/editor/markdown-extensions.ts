import { Editor, Mark } from "@tiptap/core";
import type { Extensions, JSONContent } from "@tiptap/core";
import { TaskItem } from "@tiptap/extension-task-item";
import { TaskList } from "@tiptap/extension-task-list";
import { TableKit } from "@tiptap/extension-table";
import { Underline } from "@tiptap/extension-underline";
import { Markdown } from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";

/*
 * Shared TipTap extension set for the visual editor and the compatibility
 * probe (MasterPrompt.md 4.6). Underline overrides the stock ++x++ markdown
 * output because saved source must carry sanitized <u> HTML (REQ-015); the
 * copy mark serializes to <copy> the same way (REQ-036). These are the only
 * two raw HTML tags allowed in saved Markdown.
 */
const UnderlineHtml = Underline.extend({
  renderMarkdown(node, helpers) {
    return `<u>${helpers.renderChildren(node)}</u>`;
  },
});

export const CopyMark = Mark.create({
  name: "copy",
  // Inline-only by Mark semantics (REQ-036): cannot span block boundaries.
  parseHTML() {
    return [{ tag: "copy" }];
  },
  renderHTML() {
    return ["copy", 0];
  },
  renderMarkdown(node, helpers) {
    return `<copy>${helpers.renderChildren(node)}</copy>`;
  },
});

export function markdownEditorExtensions(): Extensions {
  return [
    StarterKit.configure({ underline: false }),
    UnderlineHtml,
    CopyMark,
    TableKit,
    TaskList,
    TaskItem,
    Markdown,
  ];
}

export interface MarkdownProbe {
  parse(markdown: string): JSONContent;
  serialize(doc: JSONContent): string;
}

/*
 * The serializer emits no terminal newline; files normally carry one. Like
 * the BOM/CRLF restoration in TextFileCodec, the trailing newline is file
 * formatting the editor must preserve, not content: both the compatibility
 * comparison and the visual-editor save path restore it from the original.
 */
export function restoreTerminalNewline(serialized: string, original: string): string {
  if (original.endsWith("\n") && !serialized.endsWith("\n")) return `${serialized}\n`;
  return serialized;
}

/*
 * Headless editor whose MarkdownManager runs the parse->serialize round
 * trip. Probe output is never saved (4.6) - it exists only to compare.
 */
export function createMarkdownProbe(): MarkdownProbe {
  const editor = new Editor({ extensions: markdownEditorExtensions(), content: "" });
  return editor.storage.markdown.manager;
}
