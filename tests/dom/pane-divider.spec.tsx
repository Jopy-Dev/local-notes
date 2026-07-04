// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PaneDivider } from "../../src/frontend/components/ui/PaneDivider";

/*
 * <PaneDivider> contract (Design_System.md 9.2, REQ-034): separator ARIA
 * values mirror width bounds; arrow keys resize in 8px steps with Home/End
 * snap; Enter toggles collapse; disabled divider is inert and out of the
 * tab order.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let onResize: ReturnType<typeof vi.fn<(width: number) => void>>;
let onCommit: ReturnType<typeof vi.fn<(width: number) => void>>;
let onToggleCollapse: ReturnType<typeof vi.fn<() => void>>;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  onResize = vi.fn<(width: number) => void>();
  onCommit = vi.fn<(width: number) => void>();
  onToggleCollapse = vi.fn<() => void>();
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

async function render(props: { width?: number; disabled?: boolean } = {}) {
  await act(async () => {
    root.render(
      <PaneDivider
        pane="folder"
        width={props.width ?? 220}
        min={190}
        max={280}
        disabled={props.disabled ?? false}
        onResize={onResize}
        onCommit={onCommit}
        onToggleCollapse={onToggleCollapse}
      />,
    );
  });
  const divider = container.querySelector('[role="separator"]');
  if (!(divider instanceof HTMLElement)) throw new Error("divider not rendered");
  return divider;
}

function press(divider: HTMLElement, key: string) {
  return act(async () => {
    divider.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  });
}

describe("<PaneDivider> (REQ-034)", () => {
  it("exposes separator semantics with current/min/max width", async () => {
    const divider = await render();
    expect(divider.getAttribute("aria-orientation")).toBe("vertical");
    expect(divider.getAttribute("aria-valuenow")).toBe("220");
    expect(divider.getAttribute("aria-valuemin")).toBe("190");
    expect(divider.getAttribute("aria-valuemax")).toBe("280");
    expect(divider.tabIndex).toBe(0);
  });

  it("arrow keys resize in 8px steps and commit each step", async () => {
    const divider = await render();
    await press(divider, "ArrowRight");
    expect(onResize).toHaveBeenCalledWith(228);
    expect(onCommit).toHaveBeenCalledWith(228);
    await press(divider, "ArrowLeft");
    expect(onResize).toHaveBeenCalledWith(212);
  });

  it("Home/End snap to the bounds and steps clamp at them", async () => {
    const divider = await render();
    await press(divider, "Home");
    expect(onCommit).toHaveBeenCalledWith(190);
    await press(divider, "End");
    expect(onCommit).toHaveBeenCalledWith(280);

    onResize.mockClear();
    const atMax = await render({ width: 280 });
    await press(atMax, "ArrowRight");
    // Already at max: no resize event fires.
    expect(onResize).not.toHaveBeenCalled();
  });

  it("Enter toggles collapse", async () => {
    const divider = await render();
    await press(divider, "Enter");
    expect(onToggleCollapse).toHaveBeenCalledTimes(1);
    expect(onResize).not.toHaveBeenCalled();
  });

  it("disabled divider is inert and out of the tab order", async () => {
    const divider = await render({ disabled: true });
    expect(divider.tabIndex).toBe(-1);
    expect(divider.getAttribute("aria-disabled")).toBe("true");
    await press(divider, "ArrowRight");
    await press(divider, "Enter");
    expect(onResize).not.toHaveBeenCalled();
    expect(onToggleCollapse).not.toHaveBeenCalled();
  });
});
