// @vitest-environment jsdom
import { createRef } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotesVirtualList } from "../../src/frontend/components/ui/NotesVirtualList";
import type { NoteListEntry } from "../../src/frontend/components/ui/NoteListItem";

/*
 * REQ-031 / MasterPrompt.md 8.3: virtualized list behavior at 10,000 rows -
 * the DOM holds only the visible window plus overscan, never one node per
 * note, and the spacer height scales with the full collection. jsdom has no
 * layout, so the assertion is bounded rendering, not pixel accuracy.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/* Fires the initial observation like a real ResizeObserver does. */
class ResizeObserverStub {
  constructor(private readonly callback: ResizeObserverCallback) {}
  observe(target: Element): void {
    const bounds = target.getBoundingClientRect();
    this.callback(
      [
        {
          target,
          contentRect: bounds,
          borderBoxSize: [{ inlineSize: bounds.width, blockSize: bounds.height }],
          contentBoxSize: [{ inlineSize: bounds.width, blockSize: bounds.height }],
          devicePixelContentBoxSize: [{ inlineSize: bounds.width, blockSize: bounds.height }],
        } as unknown as ResizeObserverEntry,
      ],
      this as unknown as ResizeObserver,
    );
  }
  unobserve(): void {}
  disconnect(): void {}
}

let container: HTMLDivElement;
let scrollParent: HTMLDivElement;
let root: Root;

function rect(width: number, height: number): DOMRect {
  return {
    width,
    height,
    top: 0,
    left: 0,
    bottom: height,
    right: width,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect;
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  scrollParent = document.createElement("div");
  container = document.createElement("div");
  scrollParent.append(container);
  document.body.append(scrollParent);
  root = createRoot(container);
  // jsdom has no layout: the scroll viewport reads 600px, every row 92px.
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (
    this: Element,
  ) {
    return this === scrollParent ? rect(400, 600) : rect(400, 92);
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  scrollParent.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const TOTAL = 10_000;

function makeNotes(): NoteListEntry[] {
  return Array.from({ length: TOTAL }, (_, index) => ({
    key: `note-${index}`,
    title: `Note ${index}`,
    time: "1d",
    preview: `preview ${index}`,
    fileType: "MD",
    path: "notes",
  }));
}

async function renderList(view: "list" | "card"): Promise<void> {
  const scrollRef = createRef<HTMLDivElement>();
  Object.defineProperty(scrollRef, "current", { value: scrollParent, writable: true });
  await act(async () => {
    root.render(
      <NotesVirtualList
        notes={makeNotes()}
        view={view}
        selectedKey="note-3"
        onSelect={() => {}}
        scrollRef={scrollRef}
      />,
    );
  });
}

describe("<NotesVirtualList> (REQ-031)", () => {
  it("renders a bounded window of 10,000 list rows", async () => {
    await renderList("list");
    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons.length).toBeLessThan(100);

    const spacer = container.querySelector('[data-testid="notes-virtual-list"]') as HTMLElement;
    // 10,000 rows x 92px estimate - the scroll range covers the whole set.
    expect(Number.parseInt(spacer.style.height, 10)).toBe(TOTAL * 92);
  });

  it("card view chunks two cards per virtual row and stays bounded", async () => {
    await renderList("card");
    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons.length).toBeLessThan(100);

    const spacer = container.querySelector('[data-testid="notes-virtual-list"]') as HTMLElement;
    // Rows re-measure under the jsdom mock; assert scale, not exact pixels.
    expect(Number.parseInt(spacer.style.height, 10)).toBeGreaterThan(400_000);
  });

  it("marks the selected note inside the rendered window", async () => {
    await renderList("list");
    const selected = container.querySelector('[aria-current="true"]');
    expect(selected?.textContent).toContain("Note 3");
  });
});
