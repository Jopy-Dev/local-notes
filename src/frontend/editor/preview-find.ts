import { FIND_HIGHLIGHT_CAP, scanMatches } from "./find-in-note";
import type { FindRequest } from "./find-decorations";

/*
 * Read/split preview find (MasterPrompt.md 4.11, REQ-035): highlights the
 * server-sanitized article WITHOUT mutating its DOM - the render route
 * stays the only writer of that subtree (MasterPrompt 7.2). Painting uses
 * the CSS Custom Highlight API; browsers without it still get accurate
 * counts and active-match scrolling. Text nodes are segmented per block
 * element so a query never matches across block boundaries (parity with
 * the visual-mode plugin).
 */
const BLOCK_SELECTOR = "h1, h2, h3, h4, h5, h6, p, li, td, th, pre, blockquote";
const MATCH_HIGHLIGHT = "find-match";
const ACTIVE_HIGHLIGHT = "find-match-active";

export interface PreviewFindResult {
  total: number;
  activeElement: Element | null;
}

interface TextSegment {
  block: Element | null;
  text: string;
  nodes: { node: Text; start: number }[];
}

function collectSegments(container: HTMLElement): TextSegment[] {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const segments: TextSegment[] = [];
  let current: TextSegment | null = null;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node as Text;
    const block = text.parentElement?.closest(BLOCK_SELECTOR) ?? null;
    if (!current || current.block !== block) {
      current = { block, text: "", nodes: [] };
      segments.push(current);
    }
    current.nodes.push({ node: text, start: current.text.length });
    current.text += text.data;
  }
  return segments;
}

function domRange(segment: TextSegment, from: number, to: number): Range | null {
  const range = document.createRange();
  let startSet = false;
  for (const { node, start } of segment.nodes) {
    const end = start + node.data.length;
    if (!startSet && from >= start && from <= end) {
      range.setStart(node, from - start);
      startSet = true;
    }
    if (startSet && to >= start && to <= end) {
      range.setEnd(node, to - start);
      return range;
    }
  }
  return null;
}

function highlightApiAvailable(): boolean {
  return typeof CSS !== "undefined" && "highlights" in CSS;
}

function paint(matches: Range[], active: Range | null): void {
  if (!highlightApiAvailable()) return;
  CSS.highlights.delete(MATCH_HIGHLIGHT);
  CSS.highlights.delete(ACTIVE_HIGHLIGHT);
  if (matches.length > 0) CSS.highlights.set(MATCH_HIGHLIGHT, new Highlight(...matches));
  if (active) CSS.highlights.set(ACTIVE_HIGHLIGHT, new Highlight(active));
}

export function clearPreviewFind(): void {
  if (!highlightApiAvailable()) return;
  CSS.highlights.delete(MATCH_HIGHLIGHT);
  CSS.highlights.delete(ACTIVE_HIGHLIGHT);
}

export function applyPreviewFind(
  container: HTMLElement,
  request: FindRequest | null,
): PreviewFindResult {
  if (!request || request.query.trim() === "") {
    clearPreviewFind();
    return { total: 0, activeElement: null };
  }
  const matches: Range[] = [];
  let active: Range | null = null;
  let activeElement: Element | null = null;
  let total = 0;
  for (const segment of collectSegments(container)) {
    const scan = scanMatches(segment.text, request.query, request.caseSensitive);
    scan.ranges.forEach((match, index) => {
      if (matches.length >= FIND_HIGHLIGHT_CAP) return;
      const range = domRange(segment, match.from, match.to);
      if (!range) return;
      if (total + index === request.activeIndex) {
        active = range;
        activeElement = range.startContainer.parentElement;
      } else {
        matches.push(range);
      }
    });
    total += scan.total;
  }
  paint(matches, active);
  return { total, activeElement };
}
