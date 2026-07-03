import { useEffect, useReducer, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";
import {
  BoldIcon,
  BulletListIcon,
  CodeBlockIcon,
  ItalicIcon,
  LinkIcon,
  OrderedListIcon,
  RedoIcon,
  StrikethroughIcon,
  TableIcon,
  TaskListIcon,
  UnderlineIcon,
  UndoIcon,
} from "../components/icons";
import { IconButton } from "../components/ui/IconButton";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { createVisualEditorBinding } from "./visual-editor-binding";
import type { VisualEditorBinding } from "./visual-editor-binding";

/*
 * <VisualMarkdownEditor> per Design_System.md 9.2 (REQ-015): TipTap surface
 * for compatibility-approved notes only. Every formatting control produces
 * equivalent Markdown through the binding; the saved file stays plain
 * Markdown. External draft replacements sync in without echoing as edits.
 */
interface VisualMarkdownEditorProps {
  value: string;
  readOnly: boolean;
  onChange: (value: string) => void;
}

interface ToolbarProps {
  editor: Editor;
  readOnly: boolean;
}

function headingLabel(level: 1 | 2 | 3): string {
  return `H${level}`;
}

function Toolbar({ editor, readOnly }: ToolbarProps) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkHref, setLinkHref] = useState("");

  const run = () => editor.chain().focus();
  const toggleClass = (active: boolean) =>
    active ? "bg-surface-raised text-text-primary" : "text-text-muted hover:text-text-secondary";

  function toggleLink() {
    if (editor.isActive("link")) {
      run().unsetLink().run();
      return;
    }
    setLinkHref("");
    setLinkOpen(true);
  }

  function applyLink() {
    const href = linkHref.trim();
    if (href) run().setLink({ href }).run();
    setLinkOpen(false);
  }

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className="flex flex-wrap items-center gap-0.5 border-b border-border-subtle bg-surface-editor px-2 py-1"
    >
      <IconButton
        label="Bold"
        disabled={readOnly}
        pressed={editor.isActive("bold")}
        className={toggleClass(editor.isActive("bold"))}
        onClick={() => run().toggleBold().run()}
      >
        <BoldIcon size={15} />
      </IconButton>
      <IconButton
        label="Italic"
        disabled={readOnly}
        pressed={editor.isActive("italic")}
        className={toggleClass(editor.isActive("italic"))}
        onClick={() => run().toggleItalic().run()}
      >
        <ItalicIcon size={15} />
      </IconButton>
      <IconButton
        label="Underline"
        disabled={readOnly}
        pressed={editor.isActive("underline")}
        className={toggleClass(editor.isActive("underline"))}
        onClick={() => run().toggleUnderline().run()}
      >
        <UnderlineIcon size={15} />
      </IconButton>
      <IconButton
        label="Strike-through"
        disabled={readOnly}
        pressed={editor.isActive("strike")}
        className={toggleClass(editor.isActive("strike"))}
        onClick={() => run().toggleStrike().run()}
      >
        <StrikethroughIcon size={15} />
      </IconButton>
      <span aria-hidden className="mx-1 h-4 w-px bg-border-subtle" />
      {([1, 2, 3] as const).map((level) => (
        <button
          key={level}
          type="button"
          disabled={readOnly}
          aria-pressed={editor.isActive("heading", { level })}
          onClick={() => run().toggleHeading({ level }).run()}
          className={[
            "h-7 min-w-7 cursor-pointer rounded-control border-0 bg-transparent px-1 text-xs font-semibold",
            toggleClass(editor.isActive("heading", { level })),
          ].join(" ")}
        >
          {headingLabel(level)}
        </button>
      ))}
      <span aria-hidden className="mx-1 h-4 w-px bg-border-subtle" />
      <IconButton
        label="Bullet list"
        disabled={readOnly}
        pressed={editor.isActive("bulletList")}
        className={toggleClass(editor.isActive("bulletList"))}
        onClick={() => run().toggleBulletList().run()}
      >
        <BulletListIcon size={15} />
      </IconButton>
      <IconButton
        label="Numbered list"
        disabled={readOnly}
        pressed={editor.isActive("orderedList")}
        className={toggleClass(editor.isActive("orderedList"))}
        onClick={() => run().toggleOrderedList().run()}
      >
        <OrderedListIcon size={15} />
      </IconButton>
      <IconButton
        label="Task list"
        disabled={readOnly}
        pressed={editor.isActive("taskList")}
        className={toggleClass(editor.isActive("taskList"))}
        onClick={() => run().toggleTaskList().run()}
      >
        <TaskListIcon size={15} />
      </IconButton>
      <span aria-hidden className="mx-1 h-4 w-px bg-border-subtle" />
      <IconButton
        label={editor.isActive("link") ? "Remove link" : "Add link"}
        disabled={readOnly}
        pressed={editor.isActive("link")}
        className={toggleClass(editor.isActive("link"))}
        onClick={toggleLink}
      >
        <LinkIcon size={15} />
      </IconButton>
      <IconButton
        label="Insert table"
        disabled={readOnly}
        onClick={() => run().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
      >
        <TableIcon size={15} />
      </IconButton>
      <IconButton
        label="Code block"
        disabled={readOnly}
        pressed={editor.isActive("codeBlock")}
        className={toggleClass(editor.isActive("codeBlock"))}
        onClick={() => run().toggleCodeBlock().run()}
      >
        <CodeBlockIcon size={15} />
      </IconButton>
      <span aria-hidden className="mx-1 h-4 w-px bg-border-subtle" />
      <IconButton label="Undo" disabled={readOnly} onClick={() => run().undo().run()}>
        <UndoIcon size={15} />
      </IconButton>
      <IconButton label="Redo" disabled={readOnly} onClick={() => run().redo().run()}>
        <RedoIcon size={15} />
      </IconButton>
      {linkOpen ? (
        <form
          className="ml-2 flex items-center gap-1.5"
          onSubmit={(event) => {
            event.preventDefault();
            applyLink();
          }}
        >
          <Input
            aria-label="Link URL"
            value={linkHref}
            onChange={(event) => setLinkHref(event.target.value)}
            placeholder="https://example.com or note.md"
            className="h-7 w-56 text-xs"
            autoFocus
          />
          <Button size="sm" type="submit">
            Set link
          </Button>
          <Button size="sm" onClick={() => setLinkOpen(false)}>
            Cancel
          </Button>
        </form>
      ) : null}
    </div>
  );
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
      {editor ? <Toolbar editor={editor} readOnly={readOnly} /> : null}
      <div
        ref={hostRef}
        aria-label="Visual note editor"
        className="min-h-0 flex-1 overflow-auto px-4.5 py-3 [scrollbar-color:var(--color-border-strong)_transparent] [scrollbar-width:thin] [&_.ProseMirror]:min-h-full [&_.ProseMirror]:max-w-[76ch] [&_.ProseMirror]:outline-none"
      />
    </div>
  );
}
