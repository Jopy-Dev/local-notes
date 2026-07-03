import { describe, expect, it } from "vitest";
import { buildSnippet } from "../../src/backend/search/search-snippet.js";
import { SNIPPET_MAX_CHARS } from "../../src/shared/schemas/search.js";

// Snippet per REQ-009: max 180 chars centered around the first match; match
// ranges returned separately and aligned to the snippet text.
describe("buildSnippet", () => {
  it("returns whole short content with aligned match range", () => {
    const { snippet, matchRanges } = buildSnippet("the runway budget is fine", "runway");
    expect(snippet).toBe("the runway budget is fine");
    expect(matchRanges).toEqual([[4, 10]]);
    expect(snippet.slice(4, 10)).toBe("runway");
  });

  it("centers long content on the first match and stays under the cap", () => {
    const before = "x".repeat(400);
    const after = "y".repeat(400);
    const { snippet, matchRanges } = buildSnippet(`${before} runway ${after}`, "runway");
    expect(snippet.length).toBeLessThanOrEqual(SNIPPET_MAX_CHARS);
    const [range] = matchRanges;
    expect(range).toBeDefined();
    expect(snippet.slice(range![0], range![1]).toLocaleLowerCase()).toBe("runway");
  });

  it("marks every occurrence inside the snippet window case-insensitively", () => {
    const { snippet, matchRanges } = buildSnippet("Runway plans; runway costs.", "runway");
    expect(matchRanges).toHaveLength(2);
    for (const [start, end] of matchRanges) {
      expect(snippet.slice(start, end).toLocaleLowerCase()).toBe("runway");
    }
  });

  it("no content match yields leading snippet with no ranges", () => {
    const { snippet, matchRanges } = buildSnippet("completely unrelated body text", "runway");
    expect(snippet).toBe("completely unrelated body text");
    expect(matchRanges).toEqual([]);
  });
});
