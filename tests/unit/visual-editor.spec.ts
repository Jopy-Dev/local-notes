// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createVisualEditorBinding } from "../../src/frontend/editor/visual-editor-binding.js";

/*
 * Visual editor <-> draft binding (MasterPrompt.md 4.5/4.6, REQ-015): user
 * edits serialize back to Markdown source (terminal newline preserved);
 * external draft replacements (reload, conflict adoption) sync in without
 * echoing through onDraft as if the user typed them.
 */
const bindings: Array<{ destroy: () => void }> = [];

function bind(value: string, onDraft: (draft: string) => void) {
  const binding = createVisualEditorBinding({ value, onDraft });
  bindings.push(binding);
  return binding;
}

afterEach(() => {
  while (bindings.length) bindings.pop()?.destroy();
});

describe("visual editor binding", () => {
  it("serializes user edits back to markdown with the terminal newline kept", () => {
    const onDraft = vi.fn();
    const binding = bind("# Doc\n\nHello.\n", onDraft);
    binding.editor.commands.insertContentAt(binding.editor.state.doc.content.size, {
      type: "paragraph",
      content: [{ type: "text", text: "Appended." }],
    });
    expect(onDraft).toHaveBeenCalled();
    const draft = onDraft.mock.calls.at(-1)?.[0] as string;
    expect(draft).toContain("Appended.");
    expect(draft.endsWith("\n")).toBe(true);
    expect(draft).toContain("# Doc");
  });

  it("applies external draft replacements without echoing onDraft", () => {
    const onDraft = vi.fn();
    const binding = bind("# Doc\n\nOld.\n", onDraft);
    binding.setValue("# Doc\n\nNew disk content.\n");
    expect(binding.editor.getText()).toContain("New disk content.");
    expect(onDraft).not.toHaveBeenCalled();
  });

  it("ignores setValue when the source is already current", () => {
    const onDraft = vi.fn();
    const binding = bind("# Doc\n\nSame.\n", onDraft);
    const before = binding.editor.state.doc;
    binding.setValue("# Doc\n\nSame.\n");
    expect(binding.editor.state.doc.eq(before)).toBe(true);
    expect(onDraft).not.toHaveBeenCalled();
  });

  it("round-trips a formatting command into markdown source", () => {
    const onDraft = vi.fn();
    const binding = bind("Plain text.\n", onDraft);
    binding.editor.chain().selectAll().toggleBold().run();
    const draft = onDraft.mock.calls.at(-1)?.[0] as string;
    expect(draft).toContain("**Plain text.**");
  });
});
