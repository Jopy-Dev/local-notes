// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SourceEditor } from "../../src/frontend/editor/SourceEditor";

/*
 * Copy-tag highlight (user feedback round 4): literal <copy> and </copy>
 * tags in Markdown source carry a dedicated color so regions are easy to
 * spot. Decoration only - the document text is untouched, and .txt notes
 * (which never interpret <copy>) stay plain.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function mountEditor(language: "markdown" | "plain", value: string) {
  act(() => {
    root.render(
      <SourceEditor value={value} language={language} readOnly={false} onChange={() => {}} />,
    );
  });
}

describe("copy-tag highlight in the source editor", () => {
  it("marks <copy> and </copy> in markdown source", () => {
    mountEditor("markdown", "before\n<copy>## Heading</copy>\nafter");
    const marks = Array.from(container.querySelectorAll(".cm-copyTag"));
    expect(marks.map((mark) => mark.textContent)).toEqual(["<copy>", "</copy>"]);
  });

  it("styles the marks with the copy-tag color token", () => {
    mountEditor("markdown", "<copy>x</copy>");
    const css = Array.from(document.head.querySelectorAll("style"))
      .map((el) => el.textContent ?? "")
      .join("\n");
    const rule = css.split("}").find((chunk) => chunk.includes(".cm-copyTag"));
    expect(rule).toContain("var(--color-copy-tag)");
  });

  it("leaves plain-text notes unmarked", () => {
    mountEditor("plain", "literal <copy>text</copy> here");
    expect(container.querySelector(".cm-copyTag")).toBeNull();
  });
});
