// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ArchiveNoteView } from "../../src/frontend/components/shell/ArchiveNoteView";
import type { FindController } from "../../src/frontend/components/ui/FindInNoteBar";
import type { FindRequest } from "../../src/frontend/editor/find-in-note";

/*
 * Find in the archive view (REQ-035, follows round 10 "every Ctrl+F"):
 * archived notes are read-only but searchable - the shell's find controller
 * drives the same <FindInNoteBar>, and the request reaches the rendered
 * preview, once the archived content has loaded.
 */
const loadArchivedNote = vi.fn();
vi.mock("../../src/frontend/services/archiveApi.js", () => ({
  loadArchivedNote: (...args: unknown[]) => loadArchivedNote(...args),
  deleteArchivedNote: vi.fn(),
  restoreArchivedNote: vi.fn(),
}));
vi.mock("../../src/frontend/services/navigation.js", () => ({ navigate: vi.fn() }));
// The render route is an external boundary here; the stub reports the find
// request the preview receives.
vi.mock("../../src/frontend/editor/MarkdownPreview", () => ({
  MarkdownPreview: ({ source, find }: { source: string; find?: FindRequest | null }) => (
    <article data-find-query={find?.query ?? ""}>{source}</article>
  ),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const archivedDoc = {
  noteKey: "b2xkLm1k",
  relativePath: "old.md",
  filename: "old.md",
  title: "old",
  extension: ".md" as const,
  folder: "",
  createdAt: null,
  modifiedAt: "2026-07-01T00:00:00.000Z",
  sizeBytes: 10,
  versionToken: "a".repeat(64),
  oversized: false,
  preview: "",
  content: "Old alpha line",
  textEncoding: "utf8" as const,
  lineEnding: "lf" as const,
};

const noop = () => undefined;
function findController(open: boolean): FindController {
  const request = open ? { query: "alpha", activeIndex: 0, caseSensitive: false } : null;
  return {
    open,
    query: open ? "alpha" : "",
    caseSensitive: false,
    activeIndex: 0,
    total: 0,
    focusRequest: open ? 1 : 0,
    request,
    onQueryChange: noop,
    onToggleCase: noop,
    onNext: noop,
    onPrevious: noop,
    onClose: noop,
    onMatches: noop,
  };
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

async function render(find: FindController) {
  await act(async () => {
    root.render(
      <ArchiveNoteView noteKey="b2xkLm1k" folders={[]} onToast={noop} find={find} onOpenFind={noop} />,
    );
  });
}

const findInput = () => container.querySelector<HTMLInputElement>('input[aria-label="Find in note"]');

describe("find in the archive view", () => {
  it("shows the find bar and feeds the query to the preview once loaded", async () => {
    loadArchivedNote.mockResolvedValue(archivedDoc);
    await render(findController(true));
    expect(findInput()?.value).toBe("alpha");
    expect(container.querySelector("article")?.getAttribute("data-find-query")).toBe("alpha");
  });

  it("keeps find unavailable until the archived content loads", async () => {
    loadArchivedNote.mockReturnValue(new Promise(() => undefined));
    await render(findController(true));
    expect(findInput()).toBeNull();
  });
});
