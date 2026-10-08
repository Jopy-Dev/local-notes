// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MarkdownPreview } from "../../src/frontend/editor/MarkdownPreview";

const SOURCE = "Intro\n\n<copy>\nSee [Docs](https://example.com/docs) and [Guide](guide.md)\n</copy>\n\nOutside [Site](https://example.com)";
const COPY_SOURCE = "See [Docs](https://example.com/docs) and [Guide](guide.md)";

vi.mock("../../src/frontend/services/contentApi.js", () => ({
  renderMarkdownPreview: vi.fn(async () => ({
    html: [
      "<p>Intro</p>",
      `<copy data-block="" data-copy-source="${COPY_SOURCE}"><p>See `,
      '<a href="https://example.com/docs" rel="noopener noreferrer" data-link="external">Docs</a> and ',
      '<a href="/notes/Z3VpZGUubWQ" data-link="internal">Guide</a></p></copy>',
      '<p>Outside <a href="https://example.com" rel="noopener noreferrer" data-link="external">Site</a></p>',
    ].join(""),
  })),
}));

/*
 * REQ-036 round 10: a link inside a copy region behaves like the rest of the
 * region's text - clicking it copies the region. No external-link
 * confirmation, no browser tab, no in-app navigation. Links outside copy
 * regions keep the REQ-014 policy.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
const writeText = vi.fn(async (_text: string) => undefined);

beforeEach(() => {
  vi.useFakeTimers();
  Element.prototype.scrollIntoView ??= () => undefined;
  Object.defineProperty(window.navigator, "clipboard", { configurable: true, value: { writeText } });
  writeText.mockClear();
  // jsdom has no <dialog> implementation (same polyfill as archive-note-view).
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
});

async function renderPreview() {
  await act(async () => {
    root.render(<MarkdownPreview source={SOURCE} noteKey="bm90ZS5tZA" onToast={() => undefined} />);
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(200);
  });
}

async function click(element: Element) {
  await act(async () => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
}

const confirmDialog = () => document.querySelector("dialog[open]")?.textContent?.includes("Open external link?") ?? false;

describe("links inside copy regions copy (REQ-036, round 10)", () => {
  it("an external link inside a copy region copies the region without confirmation", async () => {
    await renderPreview();
    await click(document.querySelector('copy a[data-link="external"]') as Element);
    expect(writeText).toHaveBeenCalledWith(COPY_SOURCE);
    expect(confirmDialog()).toBe(false);
  });

  it("a note link inside a copy region copies instead of navigating", async () => {
    await renderPreview();
    const before = window.location.pathname;
    await click(document.querySelector('copy a[data-link="internal"]') as Element);
    expect(writeText).toHaveBeenCalledWith(COPY_SOURCE);
    expect(window.location.pathname).toBe(before);
  });

  it("a middle-click on a link inside a copy region never opens a browser tab", async () => {
    await renderPreview();
    const link = document.querySelector('copy a[data-link="external"]') as Element;
    let notPrevented = true;
    await act(async () => {
      notPrevented = link.dispatchEvent(new MouseEvent("auxclick", { bubbles: true, cancelable: true, button: 1 }));
    });
    expect(notPrevented).toBe(false);
  });

  it("an external link outside copy regions still asks for confirmation", async () => {
    await renderPreview();
    await click(document.querySelector('p > a[href="https://example.com"]') as Element);
    expect(writeText).not.toHaveBeenCalled();
    expect(confirmDialog()).toBe(true);
  });
});
