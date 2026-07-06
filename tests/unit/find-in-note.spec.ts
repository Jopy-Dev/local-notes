import { describe, expect, it } from "vitest";
import {
  FIND_HIGHLIGHT_CAP,
  scanMatches,
} from "../../src/frontend/editor/find-in-note.js";

/*
 * Find-in-note scan (MasterPrompt.md 4.11, REQ-035): case-insensitive by
 * default, literal query (no regex injection), highlight ranges capped at
 * 500 while the total stays accurate beyond the cap.
 */
describe("scanMatches", () => {
  it("finds case-insensitive matches with correct offsets", () => {
    const scan = scanMatches("Note text. note again. NOTE.", "note");
    expect(scan.total).toBe(3);
    expect(scan.ranges).toEqual([
      { from: 0, to: 4 },
      { from: 11, to: 15 },
      { from: 23, to: 27 },
    ]);
  });

  it("respects case when caseSensitive is set", () => {
    const scan = scanMatches("Note text. note again. NOTE.", "note", true);
    expect(scan.total).toBe(1);
    expect(scan.ranges).toEqual([{ from: 11, to: 15 }]);
  });

  it("returns zero results for an empty query", () => {
    expect(scanMatches("content", "")).toEqual({ ranges: [], total: 0 });
    expect(scanMatches("content", "   ")).toEqual({ ranges: [], total: 0 });
  });

  it("treats regex metacharacters as literal text", () => {
    const scan = scanMatches("cost is $5.00 (a+b) today", "(a+b)");
    expect(scan.total).toBe(1);
    expect(scan.ranges[0]).toEqual({ from: 14, to: 19 });
  });

  it("caps highlight ranges at 500 while the total stays accurate", () => {
    const scan = scanMatches("ab ".repeat(600), "ab");
    expect(scan.total).toBe(600);
    expect(scan.ranges).toHaveLength(FIND_HIGHLIGHT_CAP);
  });

  it("returns no ranges when nothing matches", () => {
    expect(scanMatches("plain content", "missing")).toEqual({ ranges: [], total: 0 });
  });
});
