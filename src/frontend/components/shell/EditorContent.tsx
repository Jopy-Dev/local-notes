import { useRef, useState } from "react";
import { InfoIcon } from "../icons";
import { MarkdownPreview } from "../../editor/MarkdownPreview";
import { SourceEditor } from "../../editor/SourceEditor";
import { VisualMarkdownEditor } from "../../editor/VisualMarkdownEditor";
import type { FindRequest } from "../../editor/find-decorations";
import type { EditorMode } from "../ui/EditorModeTabs";
import { SPLIT_FRACTION_DEFAULT, SplitDivider } from "../ui/SplitDivider";
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
  find: FindRequest | null;
  onFindMatches: (total: number) => void;
  onOpenFind: () => void;
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

/* Resizable split (user feedback round 1): the divider drags the fraction of
 * the first pane; grid tracks come from inline style since the value is
 * continuous. Fraction is session state, reset on note/mode remount. */
function splitTemplate(fraction: number): string {
  return `minmax(0,${fraction}fr) auto minmax(0,${1 - fraction}fr)`;
}

export function EditorContent(props: EditorContentProps) {
  const { mode, document, draft, readOnly, onChangeDraft } = props;
  const findProps = {
    find: props.find,
    onFindMatches: props.onFindMatches,
    onOpenFind: props.onOpenFind,
  };
  if (document.extension !== ".md") {
    return (
      <section aria-label="Note editor" className="grid min-h-0 min-w-0 grid-cols-[minmax(0,1fr)]">
        <SourceEditor
          value={draft}
          language="plain"
          readOnly={readOnly}
          onChange={onChangeDraft}
          {...findProps}
        />
      </section>
    );
  }

  if (mode === "read") {
    return (
      <section aria-label="Note editor" className="grid min-h-0 min-w-0 grid-cols-[minmax(0,1fr)]">
        <MarkdownPreview
          source={draft}
          noteKey={document.noteKey}
          onToast={props.onToast}
          find={props.find}
          onFindMatches={props.onFindMatches}
        />
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
            <VisualMarkdownEditor
              value={draft}
              readOnly={readOnly}
              onChange={onChangeDraft}
              find={props.find}
              onFindMatches={props.onFindMatches}
              onToast={props.onToast}
            />
          </>
        ) : (
          <>
            {readOnly ? <span /> : <SourceOnlyNotice reason={props.visualCompatibilityReason} />}
            <SourceEditor
              value={draft}
              language="markdown"
              readOnly={readOnly}
              onChange={onChangeDraft}
              {...findProps}
            />
          </>
        )}
      </section>
    );
  }

  if (mode === "source") {
    return (
      <section aria-label="Note editor" className="grid min-h-0 min-w-0 grid-cols-[minmax(0,1fr)]">
        <SourceEditor
          value={draft}
          language="markdown"
          readOnly={readOnly}
          onChange={onChangeDraft}
          {...findProps}
        />
      </section>
    );
  }

  return <SplitSurface {...props} />;
}

function SplitSurface(props: EditorContentProps) {
  const { document, draft, readOnly, onChangeDraft } = props;
  const containerRef = useRef<HTMLElement | null>(null);
  const [fraction, setFraction] = useState(SPLIT_FRACTION_DEFAULT);
  const vertical = props.splitLayout === "side";

  // Split: the source pane owns find navigation and counts; the preview
  // highlights the same query without an active match (its text ordering
  // is the rendered document, not the Markdown source).
  const preview = (
    <MarkdownPreview
      source={draft}
      noteKey={document.noteKey}
      onToast={props.onToast}
      find={props.find ? { ...props.find, activeIndex: -1 } : null}
    />
  );
  const editor = (
    <SourceEditor
      value={draft}
      language="markdown"
      readOnly={readOnly}
      onChange={onChangeDraft}
      find={props.find}
      onFindMatches={props.onFindMatches}
      onOpenFind={props.onOpenFind}
    />
  );
  const divider = (
    <SplitDivider
      orientation={vertical ? "vertical" : "horizontal"}
      fraction={fraction}
      containerSize={() =>
        vertical
          ? (containerRef.current?.clientWidth ?? 0)
          : (containerRef.current?.clientHeight ?? 0)
      }
      onChange={setFraction}
    />
  );
  return (
    <section
      ref={containerRef}
      aria-label="Note editor"
      className="grid min-h-0 min-w-0"
      style={
        vertical
          ? { gridTemplateColumns: splitTemplate(fraction) }
          : { gridTemplateRows: splitTemplate(fraction) }
      }
    >
      {props.splitLayout === "preview-top" ? preview : editor}
      {divider}
      {props.splitLayout === "preview-top" ? editor : preview}
    </section>
  );
}
