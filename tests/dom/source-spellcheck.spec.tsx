// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SourceEditor } from "../../src/frontend/editor/SourceEditor";

/*
 * REQ-041: browser-native spellcheck. Editable surfaces expose
 * spellcheck="true" on CodeMirror's contenteditable (the browser then owns
 * the wavy underline and right-click suggestions); read-only surfaces turn
 * it off. Autocorrect/autocapitalize stay off everywhere - the document
 * never changes without a user edit.
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

function mountEditor(props: { language: "markdown" | "plain"; readOnly: boolean }) {
  act(() => {
    root.render(
      <SourceEditor value="Sme misspeled text" onChange={() => {}} {...props} />,
    );
  });
}

function content(): HTMLElement {
  const element = container.querySelector<HTMLElement>(".cm-content");
  if (!element) throw new Error("CodeMirror content element not found");
  return element;
}

describe("source editor native spellcheck (REQ-041)", () => {
  it("enables spellcheck on an editable markdown surface", () => {
    mountEditor({ language: "markdown", readOnly: false });
    expect(content().getAttribute("spellcheck")).toBe("true");
    expect(content().getAttribute("autocorrect")).toBe("off");
    expect(content().getAttribute("autocapitalize")).toBe("off");
  });

  it("enables spellcheck on an editable plain-text surface", () => {
    mountEditor({ language: "plain", readOnly: false });
    expect(content().getAttribute("spellcheck")).toBe("true");
  });

  it("disables spellcheck on a read-only surface", () => {
    mountEditor({ language: "markdown", readOnly: true });
    expect(content().getAttribute("spellcheck")).toBe("false");
  });

  it("follows readOnly reconfiguration without remounting", () => {
    mountEditor({ language: "markdown", readOnly: false });
    expect(content().getAttribute("spellcheck")).toBe("true");

    mountEditor({ language: "markdown", readOnly: true });
    expect(content().getAttribute("spellcheck")).toBe("false");

    mountEditor({ language: "markdown", readOnly: false });
    expect(content().getAttribute("spellcheck")).toBe("true");
  });
});
