import { useEffect, useReducer, useRef } from "react";
import { VisualEditorToolbar } from "./VisualEditorToolbar";
import { createVisualEditorBinding } from "./visual-editor-binding";
import type { VisualEditorBinding } from "./visual-editor-binding";

/*
 * <VisualMarkdownEditor> per Design_System.md 9.2 (REQ-015): TipTap surface
 * for compatibility-approved notes only. Toolbar lives in
 * VisualEditorToolbar; external draft replacements sync in without echoing
 * as edits.
 */
interface VisualMarkdownEditorProps {
  value: string;
  readOnly: boolean;
  onChange: (value: string) => void;
}

export function VisualMarkdownEditor({ value, readOnly, onChange }: VisualMarkdownEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const bindingRef = useRef<VisualEditorBinding | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [, rerender] = useReducer((tick: number) => tick + 1, 0);

  useEffect(() => {
    if (!hostRef.current) return;
    const binding = createVisualEditorBinding({
      value,
      element: hostRef.current,
      onDraft: (draft) => onChangeRef.current(draft),
    });
    binding.editor.on("transaction", rerender);
    bindingRef.current = binding;
    rerender();
    return () => {
      binding.editor.off("transaction", rerender);
      binding.destroy();
      bindingRef.current = null;
    };
    // Mount once per host; value/readOnly sync via effects below.
  }, []);

  useEffect(() => {
    bindingRef.current?.setValue(value);
  }, [value]);

  useEffect(() => {
    bindingRef.current?.editor.setEditable(!readOnly);
  }, [readOnly]);

  const editor = bindingRef.current?.editor ?? null;

  return (
    <div className="flex min-h-0 min-w-0 flex-col bg-surface-editor">
      {editor ? <VisualEditorToolbar editor={editor} readOnly={readOnly} /> : null}
      <div
        ref={hostRef}
        aria-label="Visual note editor"
        className="min-h-0 flex-1 overflow-auto px-4.5 py-3 [scrollbar-color:var(--color-border-strong)_transparent] [scrollbar-width:thin] [&_.ProseMirror]:min-h-full [&_.ProseMirror]:max-w-[76ch] [&_.ProseMirror]:outline-none"
      />
    </div>
  );
}
