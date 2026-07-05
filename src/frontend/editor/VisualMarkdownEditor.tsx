import { useEffect, useReducer, useRef } from "react";
import { cspNonce } from "../services/csp-nonce";
import { VisualEditorToolbar } from "./VisualEditorToolbar";
import { copyToClipboard } from "./copy-actions";
import { createCopyAffordancePlugin } from "./copy-affordance-decorations";
import { createFindPlugin, findPluginKey, setFindRequest } from "./find-decorations";
import type { FindRequest } from "./find-decorations";
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
  find?: FindRequest | null;
  onFindMatches?: (total: number) => void;
  /* REQ-036 copy feedback; the affordance also lives in visual mode. */
  onToast?: (message: string) => void;
}

export function VisualMarkdownEditor({ value, readOnly, onChange, ...props }: VisualMarkdownEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const bindingRef = useRef<VisualEditorBinding | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onFindMatchesRef = useRef(props.onFindMatches);
  onFindMatchesRef.current = props.onFindMatches;
  const onToastRef = useRef(props.onToast);
  onToastRef.current = props.onToast;
  const [, rerender] = useReducer((tick: number) => tick + 1, 0);

  useEffect(() => {
    if (!hostRef.current) return;
    const nonce = cspNonce();
    const binding = createVisualEditorBinding({
      value,
      element: hostRef.current,
      onDraft: (draft) => onChangeRef.current(draft),
      ...(nonce ? { styleNonce: nonce } : {}),
    });
    binding.editor.registerPlugin(createFindPlugin());
    binding.editor.registerPlugin(
      createCopyAffordancePlugin((text) => {
        void copyToClipboard(text).then((copied) =>
          onToastRef.current?.(copied ? "Text copied" : "Copy failed - clipboard unavailable"),
        );
      }),
    );
    binding.editor.on("transaction", rerender);
    // Find totals track edits too (REQ-035 accurate count).
    const reportFindOnEdit = () => {
      const state = findPluginKey.getState(binding.editor.state);
      if (state?.request) onFindMatchesRef.current?.(state.total);
    };
    binding.editor.on("update", reportFindOnEdit);
    bindingRef.current = binding;
    rerender();
    return () => {
      binding.editor.off("update", reportFindOnEdit);
      binding.editor.off("transaction", rerender);
      binding.destroy();
      bindingRef.current = null;
    };
    // Mount once per host; value/readOnly sync via effects below.
  }, []);

  // REQ-035: sync the find request into the decoration plugin, report the
  // total up, and keep the active match visible.
  useEffect(() => {
    const editor = bindingRef.current?.editor;
    if (!editor) return;
    setFindRequest(editor.view, props.find ?? null);
    const state = findPluginKey.getState(editor.state);
    if (props.find) onFindMatchesRef.current?.(state?.total ?? 0);
    editor.view.dom.querySelector(".find-match-active")?.scrollIntoView({ block: "nearest" });
  }, [props.find]);

  useEffect(() => {
    bindingRef.current?.setValue(value);
  }, [value]);

  useEffect(() => {
    const editor = bindingRef.current?.editor;
    // Skip the no-op call: TipTap emits an update event from setEditable
    // even when nothing changes (REQ-015 no-write-without-edit).
    if (!editor || editor.isEditable === !readOnly) return;
    editor.setEditable(!readOnly);
  }, [readOnly]);

  const editor = bindingRef.current?.editor ?? null;

  return (
    <div className="flex min-h-0 min-w-0 flex-col bg-surface-editor">
      {editor ? <VisualEditorToolbar editor={editor} readOnly={readOnly} /> : null}
      <div
        ref={hostRef}
        aria-label="Visual note editor"
        className="min-h-0 flex-1 overflow-auto px-4.5 py-3 [scrollbar-color:var(--color-border-strong)_transparent] [scrollbar-width:thin] [&_.ProseMirror]:min-h-full [&_.ProseMirror]:max-w-[var(--editor-max-width,76ch)] [&_.ProseMirror]:text-[length:var(--editor-font-size,14px)] [&_.ProseMirror]:leading-[var(--editor-line-height,1.6)] [&_.ProseMirror]:outline-none"
      />
    </div>
  );
}
