import type { EditorView } from "codemirror";
import { undo, redo } from "@codemirror/commands";
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
  WrapTextIcon,
} from "../components/icons";
import { IconButton } from "../components/ui/IconButton";
import { useWorkspaceUi } from "../stores/workspaceUi";
import { applyMarkdownCommand } from "./markdown-commands";
import type { MarkdownCommandId } from "./markdown-commands";

/*
 * Source-mode formatting toolbar (user feedback round 2, REQ-016): every
 * control rewrites Markdown syntax in the CodeMirror document through the
 * pure markdown-commands transforms - the file on disk stays plain text and
 * the transform result is a normal undoable edit.
 */
interface MarkdownToolbarProps {
  getView: () => EditorView | null;
  readOnly: boolean;
}

const INLINE_CONTROLS: { command: MarkdownCommandId; label: string; icon: React.ReactNode }[] = [
  { command: "bold", label: "Bold", icon: <BoldIcon size={15} /> },
  { command: "italic", label: "Italic", icon: <ItalicIcon size={15} /> },
  { command: "underline", label: "Underline", icon: <UnderlineIcon size={15} /> },
  { command: "strike", label: "Strike-through", icon: <StrikethroughIcon size={15} /> },
  { command: "copy-mark", label: "Copyable text", icon: <CopyMarkIcon size={15} /> },
];

const LIST_CONTROLS: { command: MarkdownCommandId; label: string; icon: React.ReactNode }[] = [
  { command: "bullet-list", label: "Bullet list", icon: <BulletListIcon size={15} /> },
  { command: "ordered-list", label: "Numbered list", icon: <OrderedListIcon size={15} /> },
  { command: "task-list", label: "Task list", icon: <TaskListIcon size={15} /> },
];

const INSERT_CONTROLS: { command: MarkdownCommandId; label: string; icon: React.ReactNode }[] = [
  { command: "link", label: "Insert link", icon: <LinkIcon size={15} /> },
  { command: "table", label: "Insert table", icon: <TableIcon size={15} /> },
  { command: "code-block", label: "Code block", icon: <CodeBlockIcon size={15} /> },
];

function Divider() {
  return <span aria-hidden className="mx-1 h-4 w-px bg-border-subtle" />;
}

export function MarkdownToolbar({ getView, readOnly }: MarkdownToolbarProps) {
  function run(command: MarkdownCommandId) {
    const view = getView();
    if (!view) return;
    const main = view.state.selection.main;
    const result = applyMarkdownCommand(
      view.state.doc.toString(),
      { from: main.from, to: main.to },
      command,
    );
    view.dispatch({
      changes: result.changes,
      selection: result.selection,
      userEvent: "input",
    });
    view.focus();
  }

  function history(action: typeof undo) {
    const view = getView();
    if (!view) return;
    action(view);
    view.focus();
  }

  const groups = [LIST_CONTROLS, INSERT_CONTROLS];
  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className="flex flex-wrap items-center gap-0.5 border-b border-border-subtle bg-surface-editor px-2 py-1"
      // Keep the editor selection: buttons never take focus on press.
      onMouseDown={(event) => event.preventDefault()}
    >
      {INLINE_CONTROLS.map((control) => (
        <IconButton
          key={control.command}
          label={control.label}
          disabled={readOnly}
          onClick={() => run(control.command)}
        >
          {control.icon}
        </IconButton>
      ))}
      <Divider />
      {(["h1", "h2", "h3"] as const).map((command) => (
        <button
          key={command}
          type="button"
          disabled={readOnly}
          aria-label={`Heading ${command.slice(1)}`}
          onClick={() => run(command)}
          className="h-7 min-w-7 cursor-pointer rounded-control border-0 bg-transparent px-1 text-xs font-semibold text-text-muted hover:text-text-secondary disabled:cursor-default disabled:opacity-50"
        >
          {command.toUpperCase()}
        </button>
      ))}
      {groups.map((group, index) => (
        <span key={group[0]?.command ?? index} className="contents">
          <Divider />
          {group.map((control) => (
            <IconButton
              key={control.command}
              label={control.label}
              disabled={readOnly}
              onClick={() => run(control.command)}
            >
              {control.icon}
            </IconButton>
          ))}
        </span>
      ))}
      <Divider />
      <IconButton label="Undo" disabled={readOnly} onClick={() => history(undo)}>
        <UndoIcon size={15} />
      </IconButton>
      <IconButton label="Redo" disabled={readOnly} onClick={() => history(redo)}>
        <RedoIcon size={15} />
      </IconButton>
      <Divider />
      <LineWrapToggle />
    </div>
  );
}

/* View action, not an edit (round 3): toggles soft wrapping for every
 * source surface this session. Enabled even when the note is read-only. */
function LineWrapToggle() {
  const lineWrap = useWorkspaceUi((state) => state.lineWrap);
  const toggleLineWrap = useWorkspaceUi((state) => state.toggleLineWrap);
  return (
    <IconButton label="Line wrap" pressed={lineWrap} onClick={toggleLineWrap}>
      <WrapTextIcon size={15} />
    </IconButton>
  );
}
