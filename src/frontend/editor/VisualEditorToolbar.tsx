import { useState } from "react";
import type { Editor } from "@tiptap/core";
import {
  BoldIcon,
  BulletListIcon,
  CodeBlockIcon,
  CopyMarkIcon,
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

/*
 * Formatting toolbar for <VisualMarkdownEditor> (REQ-015/036): every control
 * produces equivalent Markdown through the binding; the copyable-text toggle
 * applies the <copy> mark (REQ-036) with the same pattern as bold/italic.
 */
interface VisualEditorToolbarProps {
  editor: Editor;
  readOnly: boolean;
}

function headingLabel(level: 1 | 2 | 3): string {
  return `H${level}`;
}

export function VisualEditorToolbar({ editor, readOnly }: VisualEditorToolbarProps) {
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
      <IconButton
        label="Copyable text"
        disabled={readOnly}
        pressed={editor.isActive("copy")}
        className={toggleClass(editor.isActive("copy"))}
        onClick={() => run().toggleMark("copy").run()}
      >
        <CopyMarkIcon size={15} />
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
