// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createVisualEditorBinding } from "../../src/frontend/editor/visual-editor-binding.js";
import {
  createFindPlugin,
  findPluginKey,
  setFindRequest,
} from "../../src/frontend/editor/find-decorations.js";

/*
 * Visual-mode find highlighting (MasterPrompt.md 4.11, REQ-035): custom
 * ProseMirror Decoration.inline plugin - no third-party TipTap search
 * extension. Decorations recompute on query meta and on doc changes; the
 * active match carries a distinct class.
 */
const bindings: Array<{ destroy: () => void }> = [];

function editorFor(value: string) {
  const binding = createVisualEditorBinding({ value, onDraft: vi.fn() });
  binding.editor.registerPlugin(createFindPlugin());
  bindings.push(binding);
  return binding.editor;
}

afterEach(() => {
  while (bindings.length) bindings.pop()?.destroy();
});

describe("find decorations plugin", () => {
  it("decorates every match and marks the active one", () => {
    const editor = editorFor("# Title\n\nnote NOTE another note\n");
    setFindRequest(editor.view, { query: "note", activeIndex: 1, caseSensitive: false });
    const state = findPluginKey.getState(editor.state);
    expect(state?.total).toBe(3);
    const decorations = state?.decorations.find() ?? [];
    expect(decorations).toHaveLength(3);
    const active = decorations.filter((decoration) => decoration.spec.active === true);
    expect(active).toHaveLength(1);
  });

  it("respects case sensitivity", () => {
    const editor = editorFor("note NOTE\n");
    setFindRequest(editor.view, { query: "NOTE", activeIndex: 0, caseSensitive: true });
    expect(findPluginKey.getState(editor.state)?.total).toBe(1);
  });

  it("recomputes on document change", () => {
    const editor = editorFor("note\n");
    setFindRequest(editor.view, { query: "note", activeIndex: 0, caseSensitive: false });
    expect(findPluginKey.getState(editor.state)?.total).toBe(1);
    editor.commands.insertContentAt(editor.state.doc.content.size, {
      type: "paragraph",
      content: [{ type: "text", text: "note note" }],
    });
    expect(findPluginKey.getState(editor.state)?.total).toBe(3);
  });

  it("clears decorations when the request is null", () => {
    const editor = editorFor("note\n");
    setFindRequest(editor.view, { query: "note", activeIndex: 0, caseSensitive: false });
    setFindRequest(editor.view, null);
    const state = findPluginKey.getState(editor.state);
    expect(state?.total).toBe(0);
    expect(state?.decorations.find() ?? []).toHaveLength(0);
  });
});
