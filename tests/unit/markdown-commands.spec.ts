import { describe, expect, it } from "vitest";
import { applyMarkdownCommand } from "../../src/frontend/editor/markdown-commands.js";
import type {
  CommandResult,
  CommandSelection,
  MarkdownCommandId,
} from "../../src/frontend/editor/markdown-commands.js";

/*
 * Source-mode toolbar transforms (user feedback round 2, REQ-016): pure
 * command core the toolbar dispatches into CodeMirror. Applying the change
 * spans here mirrors what CodeMirror does with the ChangeSpec.
 */
function apply(doc: string, sel: CommandSelection, command: MarkdownCommandId) {
  const result = applyMarkdownCommand(doc, sel, command);
  return { text: materialize(doc, result), result };
}

function materialize(doc: string, result: CommandResult): string {
  // Change spans address the original document; apply back-to-front.
  const ordered = [...result.changes].sort((a, b) => b.from - a.from);
  let text = doc;
  for (const change of ordered) {
    text = text.slice(0, change.from) + change.insert + text.slice(change.to);
  }
  return text;
}

function selectionOf(doc: string, needle: string): CommandSelection {
  const from = doc.indexOf(needle);
  if (from === -1) throw new Error(`needle not in doc: ${needle}`);
  return { from, to: from + needle.length };
}

describe("inline wraps", () => {
  it("wraps a selection in bold markers and keeps the text selected", () => {
    const doc = "make this strong today";
    const { text, result } = apply(doc, selectionOf(doc, "this strong"), "bold");
    expect(text).toBe("make **this strong** today");
    expect(text.slice(result.selection.anchor, result.selection.head)).toBe("this strong");
  });

  it("unwraps when the selection itself carries the markers", () => {
    const doc = "make **loud** quiet";
    const { text } = apply(doc, selectionOf(doc, "**loud**"), "bold");
    expect(text).toBe("make loud quiet");
  });

  it("unwraps when the markers sit immediately outside the selection", () => {
    const doc = "make **loud** quiet";
    const { text } = apply(doc, selectionOf(doc, "loud"), "bold");
    expect(text).toBe("make loud quiet");
  });

  it("collapsed selection inserts an empty pair with the caret inside", () => {
    const { text, result } = apply("ab", { from: 1, to: 1 }, "italic");
    expect(text).toBe("a**b");
    expect(result.selection.anchor).toBe(2);
    expect(result.selection.head).toBe(2);
  });

  it("italic on a bold-wrapped selection nests instead of eating a star", () => {
    const doc = "x **strong** y";
    const { text } = apply(doc, selectionOf(doc, "**strong**"), "italic");
    expect(text).toBe("x ***strong*** y");
  });

  it.each([
    ["underline", "<u>word</u>"],
    ["strike", "~~word~~"],
    ["copy-mark", "<copy>word</copy>"],
  ] as const)("%s wraps with its pair", (command, expected) => {
    const doc = "a word z";
    const { text } = apply(doc, selectionOf(doc, "word"), command);
    expect(text).toBe(`a ${expected} z`);
  });
});

describe("heading toggles", () => {
  it("adds the heading prefix to the caret line", () => {
    const doc = "line one\ntitle here\nline three";
    const sel = selectionOf(doc, "title");
    const { text } = apply(doc, sel, "h2");
    expect(text).toBe("line one\n## title here\nline three");
  });

  it("replaces an existing different-level prefix", () => {
    const doc = "# already\n";
    const { text } = apply(doc, { from: 3, to: 3 }, "h3");
    expect(text).toBe("### already\n");
  });

  it("toggles the same level off", () => {
    const doc = "## already";
    const { text } = apply(doc, { from: 4, to: 4 }, "h2");
    expect(text).toBe("already");
  });
});

describe("list toggles", () => {
  const threeLines = "alpha\nbeta\ngamma";
  const all: CommandSelection = { from: 0, to: threeLines.length };

  it("bullets every selected line", () => {
    const { text } = apply(threeLines, all, "bullet-list");
    expect(text).toBe("- alpha\n- beta\n- gamma");
  });

  it("numbers selected lines sequentially", () => {
    const { text } = apply(threeLines, all, "ordered-list");
    expect(text).toBe("1. alpha\n2. beta\n3. gamma");
  });

  it("converts a bullet list to a task list in one step", () => {
    const doc = "- alpha\n- beta";
    const { text } = apply(doc, { from: 0, to: doc.length }, "task-list");
    expect(text).toBe("- [ ] alpha\n- [ ] beta");
  });

  it("removes markers when every line already has them", () => {
    const doc = "- [ ] alpha\n- [x] beta";
    const { text } = apply(doc, { from: 0, to: doc.length }, "task-list");
    expect(text).toBe("alpha\nbeta");
  });

  it("skips blank lines inside the selection", () => {
    const doc = "alpha\n\nbeta";
    const { text } = apply(doc, { from: 0, to: doc.length }, "bullet-list");
    expect(text).toBe("- alpha\n\n- beta");
  });
});

describe("inserts", () => {
  it("link wraps the selection as the label and selects the url placeholder", () => {
    const doc = "see docs here";
    const { text, result } = apply(doc, selectionOf(doc, "docs"), "link");
    expect(text).toBe("see [docs](url) here");
    expect(text.slice(result.selection.anchor, result.selection.head)).toBe("url");
  });

  it("link with no selection inserts a template and selects the label", () => {
    const { text, result } = apply("", { from: 0, to: 0 }, "link");
    expect(text).toBe("[text](url)");
    expect(text.slice(result.selection.anchor, result.selection.head)).toBe("text");
  });

  it("code-block fences the selected lines", () => {
    const doc = "const a = 1;\nconst b = 2;";
    const { text } = apply(doc, { from: 0, to: doc.length }, "code-block");
    expect(text).toBe("```\nconst a = 1;\nconst b = 2;\n```");
  });

  it("table template lands after a non-empty current line", () => {
    const doc = "notes about x";
    const { text } = apply(doc, { from: 5, to: 5 }, "table");
    expect(text).toBe("notes about x\n\n| Column 1 | Column 2 |\n| --- | --- |\n|  |  |");
  });

  it("table template replaces an empty line in place", () => {
    const { text } = apply("", { from: 0, to: 0 }, "table");
    expect(text).toBe("| Column 1 | Column 2 |\n| --- | --- |\n|  |  |");
  });
});
