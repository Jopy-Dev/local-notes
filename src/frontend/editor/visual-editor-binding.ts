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
  styleNonce?: string;
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
    // TipTap marks the ProseMirror surface role="textbox"; the accessible
    // name must sit on that element itself - a wrapper aria-label does not
    // name it (REQ-030, axe aria-input-field-name).
    editorProps: { attributes: { "aria-label": "Note editor" } },
    // Packaged CSP has no 'unsafe-inline'; ProseMirror's injected styles
    // carry the per-response nonce (MasterPrompt.md 7.1).
    ...(options.styleNonce ? { injectNonce: options.styleNonce } : {}),
    content: "",
    onUpdate({ editor: updated, transaction }) {
      if (applyingExternal) return;
      // TipTap fires update on setEditable and other doc-neutral events
      // (REQ-015 no-write-without-edit): only real document changes may
      // become drafts, and an echo serializing back to the current source
      // is not an edit.
      if (!transaction.docChanged) return;
      const manager = updated.storage.markdown.manager;
      const draft = restoreTerminalNewline(manager.serialize(updated.getJSON()), currentSource);
      if (draft === currentSource) return;
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
