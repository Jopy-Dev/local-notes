// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { copyMarkText } from "../../src/frontend/editor/copy-mounts.js";

/*
 * REQ-036 (round 2): line-aware clipboard text for <copy> elements.
 * textContent flattens block children with no separators; the walker keeps
 * the note's line structure so multi-line copy regions paste usably.
 */
function markOf(html: string): Element {
  const host = document.createElement("div");
  host.innerHTML = html;
  const mark = host.querySelector("copy");
  if (!mark) throw new Error("fixture has no <copy>");
  return mark;
}

describe("copyMarkText", () => {
  it("keeps inline text as-is", () => {
    expect(copyMarkText(markOf("<copy>npm run dev</copy>"))).toBe("npm run dev");
  });

  it("preserves soft line breaks inside one paragraph", () => {
    expect(copyMarkText(markOf("<copy>line one\nline two</copy>"))).toBe("line one\nline two");
  });

  it("separates block children with newlines", () => {
    const mark = markOf('<copy data-block=""><p>first</p><p>second</p><ul><li>a</li><li>b</li></ul></copy>');
    expect(copyMarkText(mark)).toBe("first\nsecond\na\nb");
  });

  it("keeps code block content and tab-separates table cells", () => {
    const mark = markOf(
      '<copy data-block=""><pre><code>one\ntwo</code></pre><table><tbody><tr><td>x</td><td>y</td></tr></tbody></table></copy>',
    );
    expect(copyMarkText(mark)).toBe("one\ntwo\nx\ty");
  });

  it("turns <br> into a line break", () => {
    expect(copyMarkText(markOf("<copy>a<br>b</copy>"))).toBe("a\nb");
  });
});
