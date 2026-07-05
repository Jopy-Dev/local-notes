// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SPLIT_FRACTION_DEFAULT,
  SPLIT_FRACTION_MAX,
  SPLIT_FRACTION_MIN,
  SplitDivider,
} from "../../src/frontend/components/ui/SplitDivider";

/*
 * <SplitDivider> (user feedback round 1): editor/preview split resizer.
 * Arrow keys step 5% along the layout axis, Home/End snap to bounds,
 * double-click resets to half; fraction stays clamped to [0.2, 0.8].
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let onChange: ReturnType<typeof vi.fn<(fraction: number) => void>>;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  onChange = vi.fn<(fraction: number) => void>();
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

async function render(orientation: "vertical" | "horizontal", fraction = SPLIT_FRACTION_DEFAULT) {
  await act(async () => {
    root.render(
      <SplitDivider
        orientation={orientation}
        fraction={fraction}
        containerSize={() => 1000}
        onChange={onChange}
      />,
    );
  });
  return container.querySelector('[role="separator"]') as HTMLElement;
}

function press(element: HTMLElement, key: string) {
  element.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
}

describe("<SplitDivider>", () => {
  it("vertical: ArrowRight grows the first pane by 5%, ArrowLeft shrinks it", async () => {
    const divider = await render("vertical");
    await act(async () => press(divider, "ArrowRight"));
    expect(onChange).toHaveBeenLastCalledWith(0.55);
    await act(async () => press(divider, "ArrowLeft"));
    expect(onChange).toHaveBeenLastCalledWith(0.45);
  });

  it("horizontal: ArrowDown/ArrowUp drive the fraction; sideways arrows are inert", async () => {
    const divider = await render("horizontal");
    await act(async () => press(divider, "ArrowDown"));
    expect(onChange).toHaveBeenLastCalledWith(0.55);
    onChange.mockClear();
    await act(async () => press(divider, "ArrowRight"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("Home/End snap to the clamp bounds", async () => {
    const divider = await render("vertical");
    await act(async () => press(divider, "Home"));
    expect(onChange).toHaveBeenLastCalledWith(SPLIT_FRACTION_MIN);
    await act(async () => press(divider, "End"));
    expect(onChange).toHaveBeenLastCalledWith(SPLIT_FRACTION_MAX);
  });

  it("double-click resets to half", async () => {
    const divider = await render("vertical", 0.7);
    await act(async () => {
      divider.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    });
    expect(onChange).toHaveBeenLastCalledWith(SPLIT_FRACTION_DEFAULT);
  });

  it("keyboard steps clamp at the edges", async () => {
    const divider = await render("vertical", SPLIT_FRACTION_MAX);
    await act(async () => press(divider, "ArrowRight"));
    expect(onChange).not.toHaveBeenCalled();
    const percent = divider.getAttribute("aria-valuenow");
    expect(percent).toBe(String(SPLIT_FRACTION_MAX * 100));
  });
});
