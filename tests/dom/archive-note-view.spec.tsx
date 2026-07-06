// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ArchiveNoteView } from "../../src/frontend/components/shell/ArchiveNoteView";

/*
 * SCREEN-008 (round 2): archived note renders read-only with the archive
 * action set; Delete requires explicit confirmation before the API call.
 */
const loadArchivedNote = vi.fn();
const deleteArchivedNote = vi.fn();
const restoreArchivedNote = vi.fn();
vi.mock("../../src/frontend/services/archiveApi.js", () => ({
  loadArchivedNote: (...args: unknown[]) => loadArchivedNote(...args),
  deleteArchivedNote: (...args: unknown[]) => deleteArchivedNote(...args),
  restoreArchivedNote: (...args: unknown[]) => restoreArchivedNote(...args),
}));
vi.mock("../../src/frontend/services/navigation.js", () => ({
  navigate: vi.fn(),
}));
vi.mock("../../src/frontend/editor/MarkdownPreview", () => ({
  MarkdownPreview: ({ source }: { source: string }) => <article>{source}</article>,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const archivedDoc = {
  noteKey: "b2xkLXBsYW4ubWQ",
  relativePath: "old-plan.md",
  filename: "old-plan.md",
  title: "old-plan",
  extension: ".md" as const,
  folder: "",
  createdAt: null,
  modifiedAt: "2026-07-01T00:00:00.000Z",
  sizeBytes: 10,
  versionToken: "a".repeat(64),
  oversized: false,
  preview: "",
  content: "# Old plan",
  textEncoding: "utf8" as const,
  lineEnding: "lf" as const,
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  loadArchivedNote.mockResolvedValue(archivedDoc);
  deleteArchivedNote.mockResolvedValue({ deleted: true });
  // jsdom has no <dialog> implementation; the Modal/ConfirmationDialog
  // components call showModal()/close() on open state changes.
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
  vi.clearAllMocks();
});

async function render() {
  await act(async () => {
    root.render(<ArchiveNoteView noteKey="b2xkLXBsYW4ubWQ" folders={["projects"]} onToast={() => {}} />);
  });
}

function click(element: Element | null) {
  return act(async () => {
    (element as HTMLElement).click();
  });
}

function buttonByText(text: string): HTMLButtonElement | null {
  return (
    [...container.querySelectorAll("button")].find((button) =>
      (button.textContent ?? "").includes(text),
    ) ?? null
  );
}

describe("<ArchiveNoteView> (SCREEN-008)", () => {
  it("renders the archived content read-only with the archive banner", async () => {
    await render();
    expect(container.textContent).toContain("Archived note - read-only");
    expect(container.textContent).toContain("# Old plan");
    expect(loadArchivedNote).toHaveBeenCalledWith("b2xkLXBsYW4ubWQ");
  });

  it("offers exactly the archive action set in the more menu", async () => {
    await render();
    await click(container.querySelector('button[aria-label="More note actions"]'));
    for (const label of ["Move note", "Copy Markdown", "Copy Text", "Copy local path", "Delete"]) {
      expect(buttonByText(label), label).not.toBeNull();
    }
    expect(buttonByText("Archive note")).toBeNull();
  });

  it("Delete asks for confirmation and only then calls the API", async () => {
    await render();
    await click(container.querySelector('button[aria-label="More note actions"]'));
    await click(buttonByText("Delete"));
    expect(deleteArchivedNote).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Recycle Bin");
    const confirm = [...container.querySelectorAll("button")].filter(
      (button) => button.textContent === "Delete",
    );
    await click(confirm[confirm.length - 1] ?? null);
    expect(deleteArchivedNote).toHaveBeenCalledWith("b2xkLXBsYW4ubWQ");
  });
});
