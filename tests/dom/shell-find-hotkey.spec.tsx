// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useShellHotkeys } from "../../src/frontend/pages/useShellHotkeys";

/*
 * Ctrl+F seeding (REQ-035 rounds 9-10): a page selection seeds the find
 * query, but Chrome also reports text selected INSIDE the find input through
 * window.getSelection() - Ctrl+F there must not shrink the query to that
 * fragment; it only re-focuses and re-selects the whole query.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
const openFind = vi.fn((_selection?: string) => undefined);
const noop = () => undefined;
const handlers = {
  openCommand: noop,
  focusSearch: noop,
  openNewNote: noop,
  openSettings: noop,
  toggleSplit: noop,
  toggleFocusMode: noop,
  openFind,
  onEscape: noop,
};

function Harness() {
  useShellHotkeys(handlers);
  return (
    <>
      <p>Page text alpha</p>
      <div role="search" aria-label="Find in note">
        <input aria-label="Find in note" defaultValue="alpha" />
      </div>
    </>
  );
}

beforeEach(() => {
  openFind.mockClear();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root.render(<Harness />));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function pressCtrlF(target: Element) {
  target.dispatchEvent(new KeyboardEvent("keydown", { key: "f", ctrlKey: true, bubbles: true, cancelable: true }));
}

describe("Ctrl+F selection seeding", () => {
  it("seeds from a page selection outside the find bar", () => {
    const text = container.querySelector("p")?.firstChild as Text;
    const range = document.createRange();
    range.setStart(text, 10);
    range.setEnd(text, 15);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    pressCtrlF(container.querySelector("p") as Element);
    expect(openFind).toHaveBeenCalledWith("alpha");
  });

  it("ignores a selection inside the find input", () => {
    const field = container.querySelector("input") as HTMLInputElement;
    field.focus();
    field.setSelectionRange(1, 3);
    // Chrome mirrors the input's selection into window.getSelection().
    vi.spyOn(window, "getSelection").mockReturnValueOnce({ toString: () => "lp" } as Selection);
    pressCtrlF(field);
    expect(openFind).toHaveBeenCalledWith("");
  });
});
