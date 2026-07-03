import { SourceEditor } from "../../editor/SourceEditor";
import type { EditorMode } from "../ui/EditorModeTabs";
import type { NoteDocument } from "../../../shared/schemas/notes.js";

/*
 * Editor workspace (WF-005/006): live CodeMirror source editing for .md and
 * .txt. Read mode is the same source view locked read-only; the rendered
 * preview pane replaces the placeholder when the Markdown pipeline lands
 * (Wave 6, REQ-014 render).
 */
function PreviewPlaceholder() {
  return (
    <article
      aria-label="Rendered note"
      className="grid min-h-0 min-w-0 place-items-center overflow-auto bg-surface-editor p-6"
    >
      <p className="max-w-sm text-center text-sm leading-relaxed text-text-muted">
        Rendered Markdown preview arrives with the Markdown pipeline. Source editing is fully
        functional; the file on disk stays ordinary Markdown.
      </p>
    </article>
  );
}

interface EditorContentProps {
  mode: EditorMode;
  document: NoteDocument;
  draft: string;
  readOnly: boolean;
  onChangeDraft: (value: string) => void;
}

export function EditorContent({ mode, document, draft, readOnly, onChangeDraft }: EditorContentProps) {
  const language = document.extension === ".md" ? ("markdown" as const) : ("plain" as const);
  // Read mode = the same source view locked read-only until Wave 6 rendering.
  const sourceReadOnly = readOnly || mode === "read";

  return (
    <section
      aria-label="Note editor"
      className={
        mode === "split"
          ? "grid min-h-0 min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] desktop:grid-cols-[minmax(320px,1fr)_minmax(320px,1fr)]"
          : "grid min-h-0 min-w-0 grid-cols-[minmax(0,1fr)]"
      }
    >
      <SourceEditor
        value={draft}
        language={language}
        readOnly={sourceReadOnly}
        onChange={onChangeDraft}
      />
      {mode === "split" ? <PreviewPlaceholder /> : null}
    </section>
  );
}
