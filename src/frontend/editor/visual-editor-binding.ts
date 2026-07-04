import { Editor } from "@tiptap/core";
import type { EditorOptions } from "@tiptap/core";
import { markdownEditorExtensions, restoreTerminalNewline } from "./markdown-extensions.js";

/*
 * Binds a TipTap editor to the Markdown draft (MasterPrompt.md 4.5/4.6,
 * REQ-015): user edits serialize through getMarkdown-equivalent output with
 * the terminal newline restored; external draft replacements (reload,
 * conflict adoption) apply without echoing through onDraft. TipTap runs only
 * for notes the compatibility service approved, so parse cannot lose source.
 */
export interface VisualEditorBinding {
  editor: Editor;
  setValue(source: string): void;
  destroy(): void;
}

export interface VisualEditorBindingOptions {
  value: string;
  onDraft: (draft: string) => void;
  editable?: boolean;
  // Typed via TipTap so this module also compiles under the node tsconfig
  // (jsdom unit tests pull it into the tests include).
  element?: EditorOptions["element"];
}

export function createVisualEditorBinding(options: VisualEditorBindingOptions): VisualEditorBinding {
  let currentSource = options.value;
  let applyingExternal = false;

  const editor = new Editor({
    ...(options.element ? { element: options.element } : {}),
    extensions: markdownEditorExtensions(),
    editable: options.editable ?? true,
    content: "",
    onUpdate({ editor: updated }) {
      if (applyingExternal) return;
      const manager = updated.storage.markdown.manager;
      const draft = restoreTerminalNewline(manager.serialize(updated.getJSON()), currentSource);
      currentSource = draft;
      options.onDraft(draft);
    },
  });

  const applySource = (source: string): void => {
    applyingExternal = true;
    try {
      const manager = editor.storage.markdown.manager;
      editor.commands.setContent(manager.parse(source));
    } finally {
      applyingExternal = false;
    }
  };

  applySource(options.value);

  return {
    editor,
    setValue(source: string): void {
      if (source === currentSource) return;
      currentSource = source;
      applySource(source);
    },
    destroy(): void {
      editor.destroy();
    },
  };
}
