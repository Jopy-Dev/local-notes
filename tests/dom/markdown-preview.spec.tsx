// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MarkdownPreview } from "../../src/frontend/editor/MarkdownPreview";

vi.mock("../../src/frontend/services/contentApi.js", () => ({
  renderMarkdownPreview: vi.fn(async () => ({
    html: '<p>Use <copy>npm run dev</copy> to start.</p>',
  })),
}));

/*
 * REQ-036 copy affordance mounts (MasterPrompt.md 4.12): the IconButton
 * portals into holder spans inserted after each sanitized <copy> element and
 * MUST survive React re-renders. React re-applies dangerouslySetInnerHTML
 * whenever the prop object identity changes, which detaches injected holder
 * spans - the regression this suite pins down.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.useFakeTimers();
  // jsdom has no scrollIntoView; the find effect calls it on the active match.
  Element.prototype.scrollIntoView ??= () => undefined;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
});

async function renderPreview(props: { find?: { query: string; activeIndex: number; caseSensitive: boolean } | null } = {}) {
  await act(async () => {
    root.render(
      <MarkdownPreview
        source="Use <copy>npm run dev</copy> to start."
        noteKey="bm90ZS5tZA"
        onToast={() => undefined}
        find={props.find ?? null}
      />,
    );
  });
  // The debounce effect mounts when the first act flushes; advance past the
  // 150ms render debounce in a second act so the fetch promise settles.
  await act(async () => {
    await vi.advanceTimersByTimeAsync(200);
  });
}

describe("MarkdownPreview copy affordance (REQ-036)", () => {
  it("mounts a connected copy button after each sanitized <copy> element", async () => {
    await renderPreview();
    const holders = [...document.querySelectorAll("[data-copy-affordance]")];
    expect(holders).toHaveLength(1);
    expect(holders[0]?.isConnected).toBe(true);
    const button = holders[0]?.querySelector('button[aria-label="Copy marked text"]');
    expect(button).not.toBeNull();
  });

  it("keeps the affordance attached across re-renders with unchanged html", async () => {
    await renderPreview();
    // Any prop-driven re-render (find bar typing) must not detach the holder.
    await renderPreview({ find: { query: "start", activeIndex: 0, caseSensitive: false } });
    const holders = [...document.querySelectorAll("[data-copy-affordance]")];
    expect(holders).toHaveLength(1);
    expect(holders[0]?.isConnected).toBe(true);
    expect(holders[0]?.querySelector("button")).not.toBeNull();
  });
});
