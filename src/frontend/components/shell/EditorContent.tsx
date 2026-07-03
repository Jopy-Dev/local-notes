import { InfoIcon } from "../icons";
import { MarkdownPreview } from "../../editor/MarkdownPreview";
import { SourceEditor } from "../../editor/SourceEditor";
import { VisualMarkdownEditor } from "../../editor/VisualMarkdownEditor";
import type { EditorMode } from "../ui/EditorModeTabs";
import type { NoteDocument } from "../../../shared/schemas/notes.js";

/*
 * Editor workspace (WF-005/006, REQ-014/015/016): mode-routed surfaces.
 * Read = server-sanitized preview; Edit = TipTap for compatibility-approved
 * .md (source fallback with explanation otherwise); Source = CodeMirror;
 * Split = source + live preview. .txt is always the plain editor.
 */
export type SplitLayout = "side" | "preview-top" | "preview-bottom";

interface EditorContentProps {
  mode: EditorMode;
  document: NoteDocument;
  draft: string;
  readOnly: boolean;
  visualCompatibility: "edit" | "source-only";
  visualCompatibilityReason: string | null;
  splitLayout: SplitLayout;
  onChangeDraft: (value: string) => void;
  onToast: (message: string) => void;
}

function SourceOnlyNotice({ reason }: { reason: string | null }) {
  return (
    <div
      role="status"
      className="flex items-center gap-2 border-b border-border-subtle bg-surface-panel px-3 py-1.5 text-xs text-info"
    >
      <InfoIcon size={14} />
      <span>
        Visual editing is unavailable for this note - editing Markdown source instead.
        {reason ? ` ${reason}` : ""}
      </span>
    </div>
  );
}

const splitGrid: Record<SplitLayout, string> = {
  side: "grid min-h-0 min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] desktop:grid-cols-[minmax(320px,1fr)_minmax(320px,1fr)]",
  "preview-top": "grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_minmax(0,1fr)]",
  "preview-bottom": "grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_minmax(0,1fr)]",
};

export function EditorContent(props: EditorContentProps) {
  const { mode, document, draft, readOnly, onChangeDraft } = props;
  if (document.extension !== ".md") {
    return (
      <section aria-label="Note editor" className="grid min-h-0 min-w-0 grid-cols-[minmax(0,1fr)]">
        <SourceEditor value={draft} language="plain" readOnly={readOnly} onChange={onChangeDraft} />
      </section>
    );
  }

  if (mode === "read") {
    return (
      <section aria-label="Note editor" className="grid min-h-0 min-w-0 grid-cols-[minmax(0,1fr)]">
        <MarkdownPreview source={draft} noteKey={document.noteKey} onToast={props.onToast} />
      </section>
    );
  }

  if (mode === "edit") {
    const visual = !readOnly && props.visualCompatibility === "edit";
    return (
      <section
        aria-label="Note editor"
        className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)]"
      >
        {visual ? (
          <>
            <span />
            <VisualMarkdownEditor value={draft} readOnly={readOnly} onChange={onChangeDraft} />
          </>
        ) : (
          <>
            {readOnly ? <span /> : <SourceOnlyNotice reason={props.visualCompatibilityReason} />}
            <SourceEditor
              value={draft}
              language="markdown"
              readOnly={readOnly}
              onChange={onChangeDraft}
            />
          </>
        )}
      </section>
    );
  }

  if (mode === "source") {
    return (
      <section aria-label="Note editor" className="grid min-h-0 min-w-0 grid-cols-[minmax(0,1fr)]">
        <SourceEditor value={draft} language="markdown" readOnly={readOnly} onChange={onChangeDraft} />
      </section>
    );
  }

  const preview = <MarkdownPreview source={draft} noteKey={document.noteKey} onToast={props.onToast} />;
  const editor = (
    <SourceEditor value={draft} language="markdown" readOnly={readOnly} onChange={onChangeDraft} />
  );
  return (
    <section aria-label="Note editor" className={splitGrid[props.splitLayout]}>
      {props.splitLayout === "preview-top" ? preview : editor}
      {props.splitLayout === "preview-top" ? editor : preview}
    </section>
  );
}
