// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { VisualMarkdownEditor } from "../../src/frontend/editor/VisualMarkdownEditor";

/*
 * REQ-036 in visual mode (user feedback round 1): every copy-marked span
 * carries a click-to-copy widget while editing - previously the affordance
 * existed only in the rendered preview, so Edit mode showed styled text with
 * nothing to click. Clipboard is the mocked external boundary.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let container: HTMLDivElement;
let root: Root;
let written: string[];

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  written = [];
  // Spreading jsdom's navigator drops its prototype getters (ProseMirror
  // reads userAgent) - patch the clipboard property only.
  Object.defineProperty(window.navigator, "clipboard", {
    configurable: true,
    value: { writeText: async (text: string) => void written.push(text) },
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  delete (window.navigator as { clipboard?: unknown }).clipboard;
});

async function mount(source: string, onToast: (message: string) => void): Promise<void> {
  await act(async () => {
    root.render(
      <VisualMarkdownEditor value={source} readOnly={false} onChange={() => {}} onToast={onToast} />,
    );
  });
  await act(async () => {
    await wait(60);
  });
}

describe("visual editor copy affordance (REQ-036)", () => {
  it("renders a copy button after each copy-marked span and copies its text", async () => {
    const toasts: string[] = [];
    await mount("One <copy>alpha token</copy> and <copy>beta</copy> here.\n", (m) => toasts.push(m));

    const buttons = container.querySelectorAll("button.copy-affordance");
    expect(buttons.length).toBe(2);

    await act(async () => {
      (buttons[0] as HTMLButtonElement).click();
      await wait(20);
    });
    expect(written).toEqual(["alpha token"]);
    expect(toasts).toEqual(["Text copied"]);
  });

  it("renders no affordance without copy marks", async () => {
    await mount("Plain paragraph only.\n", () => {});
    expect(container.querySelectorAll("button.copy-affordance").length).toBe(0);
  });
});
