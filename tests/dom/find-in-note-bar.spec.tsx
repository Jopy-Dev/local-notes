// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FindInNoteBar } from "../../src/frontend/components/ui/FindInNoteBar";

/*
 * Find bar prefill (round 9, REQ-035): Ctrl+F with a text selection seeds
 * the query from outside the bar. The input must adopt the external query -
 * including while already open - and select it so typing replaces it.
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

const noop = () => {};

function renderBar(query: string, onQueryChange: (query: string) => void = noop, focusRequest = 1) {
  act(() => {
    root.render(
      <FindInNoteBar
        query={query}
        focusRequest={focusRequest}
        caseSensitive={false}
        activeIndex={0}
        total={0}
        onQueryChange={onQueryChange}
        onToggleCase={noop}
        onNext={noop}
        onPrevious={noop}
        onClose={noop}
      />,
    );
  });
}

function input(): HTMLInputElement {
  const element = container.querySelector<HTMLInputElement>('input[aria-label="Find in note"]');
  if (!element) throw new Error("Find input not found");
  return element;
}

describe("find bar query prefill", () => {
  it("shows a seeded query selected for replacement on open", () => {
    renderBar("invoices");
    expect(input().value).toBe("invoices");
    expect(input().selectionStart).toBe(0);
    expect(input().selectionEnd).toBe("invoices".length);
  });

  it("adopts an external query change while already open", () => {
    renderBar("");
    renderBar("village");
    expect(input().value).toBe("village");
    expect(input().selectionEnd).toBe("village".length);
  });

  it("does not clobber typing when the debounced commit echoes back", () => {
    vi.useFakeTimers();
    const onQueryChange = vi.fn();
    renderBar("", onQueryChange);
    act(() => {
      const element = input();
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      setter?.call(element, "vil");
      element.dispatchEvent(new Event("input", { bubbles: true }));
    });
    act(() => {
      vi.runAllTimers();
    });
    expect(onQueryChange).toHaveBeenCalledWith("vil");
    // Parent state commits the same value back down - input must keep it.
    renderBar("vil", onQueryChange);
    expect(input().value).toBe("vil");
    vi.useRealTimers();
  });
});

describe("every Ctrl+F lands in the find input (round 10)", () => {
  it("re-invoking find while open focuses the input and selects the existing query", () => {
    renderBar("alpha", noop, 1);
    const outside = document.createElement("button");
    document.body.append(outside);
    outside.focus();
    input().setSelectionRange(5, 5);
    expect(document.activeElement).toBe(outside);

    renderBar("alpha", noop, 2);

    expect(document.activeElement).toBe(input());
    expect(input().selectionStart).toBe(0);
    expect(input().selectionEnd).toBe("alpha".length);
    outside.remove();
  });

  it("re-invoking find with the caret already in the input selects the whole query", () => {
    renderBar("alpha", noop, 1);
    input().focus();
    input().setSelectionRange(2, 2);

    renderBar("alpha", noop, 2);

    expect(input().selectionStart).toBe(0);
    expect(input().selectionEnd).toBe("alpha".length);
  });
});
