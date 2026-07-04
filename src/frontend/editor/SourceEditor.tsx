import { useEffect, useRef } from "react";
import { EditorView, basicSetup } from "codemirror";
import { Annotation, EditorState, Compartment, Prec } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { markdown } from "@codemirror/lang-markdown";
import { cmFind, findField, useCmFind } from "./cm-find";
import { quietWorkbenchSyntaxHighlighting, quietWorkbenchTheme } from "./cm-theme";
import type { FindRequest } from "./find-decorations";

/*
 * <SourceEditor> per Design_System.md 9.2: CodeMirror 6 source/plain editor.
 * Theme lives in cm-theme.ts; find decorations + sync in cm-find.ts.
 * External draft replacements (reload/conflict resolution) sync via
 * dispatch, never remount.
 */
const themeCompartment = new Compartment();
const readOnlyCompartment = new Compartment();
const languageCompartment = new Compartment();
// Marks programmatic value syncs (reload/conflict adoption) so they never
// echo back through onChange as if the user typed them.
const externalSync = Annotation.define<boolean>();

interface SourceEditorProps {
  value: string;
  language: "markdown" | "plain";
  readOnly: boolean;
  onChange: (value: string) => void;
  find?: FindRequest | null;
  onFindMatches?: (total: number) => void;
  onOpenFind?: () => void;
}

export function SourceEditor({ value, language, readOnly, onChange, ...props }: SourceEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onFindMatchesRef = useRef(props.onFindMatches);
  onFindMatchesRef.current = props.onFindMatches;
  const onOpenFindRef = useRef(props.onOpenFind);
  onOpenFindRef.current = props.onOpenFind;

  useEffect(() => {
    if (!hostRef.current) return;
    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          // FindInNoteBar owns find UI (REQ-035) - shadow basicSetup's
          // native Mod-f search panel before it can open.
          Prec.highest(
            keymap.of([
              {
                key: "Mod-f",
                run: () => {
                  onOpenFindRef.current?.();
                  return true;
                },
              },
            ]),
          ),
          basicSetup,
          cmFind(),
          themeCompartment.of(quietWorkbenchTheme),
          quietWorkbenchSyntaxHighlighting,
          languageCompartment.of(language === "markdown" ? markdown() : []),
          readOnlyCompartment.of(EditorState.readOnly.of(readOnly)),
          EditorView.lineWrapping,
          EditorView.updateListener.of((update) => {
            if (!update.docChanged) return;
            // Find totals track edits too (REQ-035 accurate count).
            const findValue = update.state.field(findField);
            if (findValue.request) onFindMatchesRef.current?.(findValue.total);
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

  useCmFind(viewRef, props.find, props.onFindMatches);

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
