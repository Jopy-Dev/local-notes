import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { StateEffect, StateField } from "@codemirror/state";
import type { Extension } from "@codemirror/state";
import { Decoration, EditorView } from "@codemirror/view";
import type { DecorationSet } from "@codemirror/view";
import { scanMatches } from "./find-in-note";
import type { FindRange, FindRequest } from "./find-in-note";

/*
 * Source-mode find highlighting (MasterPrompt.md 4.11, REQ-035): decoration
 * StateField over the shared scan (find-in-note.ts) so source counts match
 * visual/preview counts exactly. The FindInNoteBar is the only search UI -
 * basicSetup's native search panel keymap is overridden in SourceEditor.
 */
export const setFindEffect = StateEffect.define<FindRequest | null>();

export interface CmFindValue {
  request: FindRequest | null;
  decorations: DecorationSet;
  total: number;
  activeRange: FindRange | null;
}

const EMPTY: CmFindValue = {
  request: null,
  decorations: Decoration.none,
  total: 0,
  activeRange: null,
};

const matchMark = Decoration.mark({ class: "find-match" });
const activeMark = Decoration.mark({ class: "find-match-active" });

function compute(text: string, request: FindRequest | null): CmFindValue {
  if (!request || request.query.trim() === "") return { ...EMPTY, request };
  const scan = scanMatches(text, request.query, request.caseSensitive);
  let activeRange: FindRange | null = null;
  const marks = scan.ranges.map((range, index) => {
    const active = index === request.activeIndex;
    if (active) activeRange = range;
    return (active ? activeMark : matchMark).range(range.from, range.to);
  });
  return {
    request,
    decorations: Decoration.set(marks, true),
    total: scan.total,
    activeRange,
  };
}

export const findField = StateField.define<CmFindValue>({
  create: () => EMPTY,
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setFindEffect)) return compute(tr.newDoc.toString(), effect.value);
    }
    if (tr.docChanged && value.request) return compute(tr.newDoc.toString(), value.request);
    return value;
  },
  provide: (field) => EditorView.decorations.from(field, (value) => value.decorations),
});

export function cmFind(): Extension {
  return [findField];
}

/*
 * Host-side sync (REQ-035): push the shared find request into the field,
 * report the total up, and keep the active match in view.
 */
export function useCmFind(
  viewRef: RefObject<EditorView | null>,
  find: FindRequest | null | undefined,
  onFindMatches: ((total: number) => void) | undefined,
): void {
  const onFindMatchesRef = useRef(onFindMatches);
  onFindMatchesRef.current = onFindMatches;

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: setFindEffect.of(find ?? null) });
    const state = view.state.field(findField);
    onFindMatchesRef.current?.(state.total);
    if (state.activeRange) {
      view.dispatch({
        effects: EditorView.scrollIntoView(state.activeRange.from, { y: "nearest" }),
      });
    }
  }, [viewRef, find]);
}
