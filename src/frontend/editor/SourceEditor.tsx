import { useEffect, useRef } from "react";
import { EditorView, basicSetup } from "codemirror";
import { Annotation, EditorState, Compartment } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";

/*
 * <SourceEditor> per Design_System.md 9.2: CodeMirror 6 source/plain editor.
 * Theme maps Quiet Workbench tokens through CSS variables - no raw colors
 * here (tokens resolve from the Tailwind theme at runtime). External draft
 * replacements (reload/conflict resolution) sync via dispatch, never remount.
 */
const themeCompartment = new Compartment();
const readOnlyCompartment = new Compartment();
const languageCompartment = new Compartment();
// Marks programmatic value syncs (reload/conflict adoption) so they never
// echo back through onChange as if the user typed them.
const externalSync = Annotation.define<boolean>();

const quietWorkbenchTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "var(--color-surface-code)",
      color: "var(--color-text-source)",
      height: "100%",
      fontSize: "13px",
    },
    ".cm-content": {
      fontFamily: "var(--font-mono)",
      lineHeight: "1.7",
      caretColor: "var(--color-focus)",
      maxWidth: "76ch",
      paddingBottom: "5rem",
    },
    ".cm-gutters": {
      backgroundColor: "var(--color-surface-code)",
      color: "var(--color-text-disabled)",
      border: "none",
    },
    "&.cm-focused": { outline: "none" },
    ".cm-cursor": { borderLeftColor: "var(--color-focus)" },
    ".cm-activeLine": { backgroundColor: "transparent" },
    ".cm-activeLineGutter": {
      backgroundColor: "transparent",
      color: "var(--color-text-muted)",
    },
    ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
      backgroundColor: "var(--color-surface-selected)",
    },
  },
  { dark: true },
);

interface SourceEditorProps {
  value: string;
  language: "markdown" | "plain";
  readOnly: boolean;
  onChange: (value: string) => void;
}

export function SourceEditor({ value, language, readOnly, onChange }: SourceEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!hostRef.current) return;
    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          basicSetup,
          themeCompartment.of(quietWorkbenchTheme),
          languageCompartment.of(language === "markdown" ? markdown() : []),
          readOnlyCompartment.of(EditorState.readOnly.of(readOnly)),
          EditorView.lineWrapping,
          EditorView.updateListener.of((update) => {
            if (!update.docChanged) return;
            if (update.transactions.some((tr) => tr.annotation(externalSync))) return;
            onChangeRef.current(update.state.doc.toString());
          }),
        ],
      }),
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Mount once per host; content/config sync happens via dispatch below.
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: [
        readOnlyCompartment.reconfigure(EditorState.readOnly.of(readOnly)),
        languageCompartment.reconfigure(language === "markdown" ? markdown() : []),
      ],
    });
  }, [readOnly, language]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
        annotations: externalSync.of(true),
      });
    }
  }, [value]);

  return (
    <div
      ref={hostRef}
      aria-label="Note source editor"
      className="min-h-0 min-w-0 overflow-auto bg-surface-code [scrollbar-color:var(--color-border-strong)_transparent] [scrollbar-width:thin]"
    />
  );
}
