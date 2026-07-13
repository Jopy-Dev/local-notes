// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { applyPreviewFind } from "../../src/frontend/editor/preview-find.js";

/*
 * Read/split preview find (REQ-035): match ranges computed over the
 * sanitized article's text nodes, segmented per block element so a query
 * never matches across block boundaries (parity with the visual-mode
 * plugin). Highlight painting uses the CSS Custom Highlight API when the
 * browser provides it; counting works without it (jsdom has none).
 */
function containerOf(html: string): HTMLElement {
  const container = document.createElement("article");
  container.innerHTML = html;
  document.body.append(container);
  return container;
}

describe("applyPreviewFind", () => {
  it("counts case-insensitive matches across the rendered article", () => {
    const container = containerOf("<h1>Note title</h1><p>note body <strong>NOTE</strong></p>");
    const result = applyPreviewFind(container, {
      query: "note",
      activeIndex: 0,
      caseSensitive: false,
    });
    expect(result.total).toBe(3);
  });

  it("never matches across block boundaries", () => {
    const container = containerOf("<p>foo</p><p>bar</p>");
    const result = applyPreviewFind(container, {
      query: "foobar",
      activeIndex: 0,
      caseSensitive: false,
    });
    expect(result.total).toBe(0);
  });

  it("matches across inline mark boundaries inside one block", () => {
    const container = containerOf("<p>fo<strong>ob</strong>ar</p>");
    const result = applyPreviewFind(container, {
      query: "foobar",
      activeIndex: 0,
      caseSensitive: false,
    });
    expect(result.total).toBe(1);
  });

  it("returns the active match element for scrolling", () => {
    const container = containerOf("<p>first note</p><p id='second'>second note</p>");
    const result = applyPreviewFind(container, {
      query: "note",
      activeIndex: 1,
      caseSensitive: false,
    });
    expect(result.activeElement?.closest("#second")).not.toBeNull();
  });

  it("clamps an overflowing active index to the last rendered match", () => {
    // Split view (round 9): the shared index counts SOURCE matches; the
    // rendered text can hold fewer (markdown syntax). Clamp keeps a nearby
    // active match instead of dropping tracking entirely.
    const container = containerOf("<p>first note</p><p id='last'>second note</p>");
    const result = applyPreviewFind(container, {
      query: "note",
      activeIndex: 5,
      caseSensitive: false,
    });
    expect(result.activeElement).not.toBeNull();
    expect(result.activeElement?.closest("#last")).not.toBeNull();
  });

  it("marks no active match for a negative active index", () => {
    const container = containerOf("<p>note</p>");
    const result = applyPreviewFind(container, {
      query: "note",
      activeIndex: -1,
      caseSensitive: false,
    });
    expect(result.total).toBe(1);
    expect(result.activeElement).toBeNull();
  });

  it("clears to zero on a null request", () => {
    const container = containerOf("<p>note</p>");
    applyPreviewFind(container, { query: "note", activeIndex: 0, caseSensitive: false });
    const result = applyPreviewFind(container, null);
    expect(result.total).toBe(0);
    expect(result.activeElement).toBeNull();
  });
});
