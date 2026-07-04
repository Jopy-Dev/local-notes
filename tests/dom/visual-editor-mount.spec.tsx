// @vitest-environment jsdom
import { StrictMode, act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { VisualMarkdownEditor } from "../../src/frontend/editor/VisualMarkdownEditor";

/*
 * REQ-015 no-write-without-edit: opening a note in the visual editor must
 * never emit onChange - TipTap fires its update event on setEditable with no
 * document change, and any echo reaching changeDraft becomes a spurious
 * autosave write (whitespace-normalized content on disk). Regression for the
 * Wave 7 spurious-write defect.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const shapes = {
  canonical: "# T\n\nBody.\n",
  taskList: "- [ ] a\n- [x] b\n",
  bareUrl: "see http://example.com now\n",
} as const;

async function mountProbe(source: string, strict: boolean): Promise<string[]> {
  const calls: string[] = [];
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const tree = (
    <VisualMarkdownEditor
      value={source}
      readOnly={false}
      onChange={(value) => calls.push(value)}
    />
  );
  await act(async () => {
    root.render(strict ? <StrictMode>{tree}</StrictMode> : tree);
  });
  await act(async () => {
    await wait(60);
  });
  await act(async () => root.unmount());
  container.remove();
  return calls;
}

describe("visual editor mount (REQ-015 no-write-without-edit)", () => {
  for (const [name, source] of Object.entries(shapes)) {
    it(`mount emits no onChange: ${name}`, async () => {
      const calls = await mountProbe(source, false);
      expect(calls, `onChange fired on mount: ${JSON.stringify(calls)}`).toEqual([]);
    });
  }

  it("StrictMode double-mount emits no onChange", async () => {
    const calls = await mountProbe(shapes.canonical, true);
    expect(calls, `onChange fired on mount: ${JSON.stringify(calls)}`).toEqual([]);
  });

  it("toggling readOnly emits no onChange", async () => {
    const calls: string[] = [];
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const render = (readOnly: boolean) =>
      root.render(
        <VisualMarkdownEditor
          value={shapes.canonical}
          readOnly={readOnly}
          onChange={(value) => calls.push(value)}
        />,
      );
    await act(async () => render(false));
    await act(async () => render(true));
    await act(async () => render(false));
    await act(async () => {
      await wait(60);
    });
    await act(async () => root.unmount());
    container.remove();
    expect(calls, `onChange fired on readOnly toggle: ${JSON.stringify(calls)}`).toEqual([]);
  });
});
