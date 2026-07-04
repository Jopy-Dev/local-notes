// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import {
  cmFind,
  findField,
  setFindEffect,
} from "../../src/frontend/editor/cm-find.js";

/*
 * Source-mode find highlighting (MasterPrompt.md 4.11, REQ-035): decoration
 * StateField over the shared scan so source counts match visual/preview
 * counts exactly. Decorations recompute on query effect and doc change.
 */
function stateOf(doc: string) {
  return EditorState.create({ doc, extensions: cmFind() });
}

describe("cm find field", () => {
  it("computes decorations and total for a query", () => {
    let state = stateOf("note text\nNOTE again");
    state = state.update({
      effects: setFindEffect.of({ query: "note", activeIndex: 1, caseSensitive: false }),
    }).state;
    const value = state.field(findField);
    expect(value.total).toBe(2);
    expect(value.activeRange).toEqual({ from: 10, to: 14 });
  });

  it("recomputes on document change", () => {
    let state = stateOf("note");
    state = state.update({
      effects: setFindEffect.of({ query: "note", activeIndex: 0, caseSensitive: false }),
    }).state;
    state = state.update({ changes: { from: 4, insert: " note note" } }).state;
    expect(state.field(findField).total).toBe(3);
  });

  it("clears on a null request", () => {
    let state = stateOf("note");
    state = state.update({
      effects: setFindEffect.of({ query: "note", activeIndex: 0, caseSensitive: false }),
    }).state;
    state = state.update({ effects: setFindEffect.of(null) }).state;
    const value = state.field(findField);
    expect(value.total).toBe(0);
    expect(value.activeRange).toBeNull();
  });
});
