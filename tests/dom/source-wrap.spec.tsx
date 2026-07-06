// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SourceEditor } from "../../src/frontend/editor/SourceEditor";
import { useWorkspaceUi } from "../../src/frontend/stores/workspaceUi";

/*
 * Line-wrap toggle (user feedback round 3): a toolbar view action turns
 * soft wrapping in Source mode off and on. View preference only - the
 * document text never changes; session state shared by every editor.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  useWorkspaceUi.setState({ lineWrap: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function mountEditor() {
  act(() => {
    root.render(
      <SourceEditor
        value={"a long line\nanother"}
        language="markdown"
        readOnly={false}
        onChange={() => {}}
        toolbar
      />,
    );
  });
}

function wrapButton(): HTMLButtonElement {
  const button = container.querySelector<HTMLButtonElement>('button[aria-label="Line wrap"]');
  if (!button) throw new Error("Line wrap toggle not found");
  return button;
}

describe("source editor line-wrap toggle", () => {
  it("wraps by default and the toolbar action unwraps", () => {
    mountEditor();
    expect(container.querySelector(".cm-content.cm-lineWrapping")).not.toBeNull();
    expect(wrapButton().getAttribute("aria-pressed")).toBe("true");

    act(() => wrapButton().click());
    expect(container.querySelector(".cm-content.cm-lineWrapping")).toBeNull();
    expect(wrapButton().getAttribute("aria-pressed")).toBe("false");

    act(() => wrapButton().click());
    expect(container.querySelector(".cm-content.cm-lineWrapping")).not.toBeNull();
  });

  it("keeps the document text unchanged when toggling", () => {
    mountEditor();
    act(() => wrapButton().click());
    expect(container.querySelector(".cm-content")?.textContent).toContain("a long line");
  });

  it("a new editor honors the session wrap preference", () => {
    useWorkspaceUi.setState({ lineWrap: false });
    mountEditor();
    expect(container.querySelector(".cm-content.cm-lineWrapping")).toBeNull();
  });
});
