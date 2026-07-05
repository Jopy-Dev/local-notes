import { useRef } from "react";
import type { KeyboardEvent, PointerEvent } from "react";

/*
 * <SplitDivider>: separator between the editor and preview panes in split
 * mode. Drag (or arrow keys, 5% steps; Home/End snap to bounds) moves the
 * split fraction; double-click resets to half. Session-only state - the
 * fraction never persists (unlike REQ-034 pane widths). Orientation follows
 * the split layout: vertical bar for side-by-side, horizontal for stacked.
 */
export const SPLIT_FRACTION_MIN = 0.2;
export const SPLIT_FRACTION_MAX = 0.8;
export const SPLIT_FRACTION_DEFAULT = 0.5;
const KEY_STEP = 0.05;

interface SplitDividerProps {
  orientation: "vertical" | "horizontal";
  fraction: number;
  /* Size in px of the split container along the drag axis. */
  containerSize: () => number;
  onChange: (fraction: number) => void;
}

const clamp = (value: number) =>
  Math.min(SPLIT_FRACTION_MAX, Math.max(SPLIT_FRACTION_MIN, value));

function fractionForKey(key: string, fraction: number, orientation: string): number | null {
  const decrease = orientation === "vertical" ? "ArrowLeft" : "ArrowUp";
  const increase = orientation === "vertical" ? "ArrowRight" : "ArrowDown";
  switch (key) {
    case decrease:
      return clamp(fraction - KEY_STEP);
    case increase:
      return clamp(fraction + KEY_STEP);
    case "Home":
      return SPLIT_FRACTION_MIN;
    case "End":
      return SPLIT_FRACTION_MAX;
    default:
      return null;
  }
}

export function SplitDivider({ orientation, fraction, containerSize, onChange }: SplitDividerProps) {
  const drag = useRef<{ pointerId: number; start: number; startFraction: number } | null>(null);
  const vertical = orientation === "vertical";

  const axisPosition = (event: PointerEvent<HTMLDivElement>) =>
    vertical ? event.clientX : event.clientY;

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointerId: event.pointerId, start: axisPosition(event), startFraction: fraction };
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current || event.pointerId !== drag.current.pointerId) return;
    const size = containerSize();
    if (size <= 0) return;
    const delta = (axisPosition(event) - drag.current.start) / size;
    onChange(clamp(drag.current.startFraction + delta));
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerId !== drag.current?.pointerId) return;
    drag.current = null;
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const next = fractionForKey(event.key, fraction, orientation);
    if (next === null || next === fraction) return;
    event.preventDefault();
    onChange(next);
  }

  return (
    <div
      role="separator"
      aria-orientation={orientation}
      aria-label="Resize editor and preview panes"
      aria-valuenow={Math.round(fraction * 100)}
      aria-valuemin={SPLIT_FRACTION_MIN * 100}
      aria-valuemax={SPLIT_FRACTION_MAX * 100}
      tabIndex={0}
      title="Drag or use arrow keys to resize. Double-click to reset."
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onKeyDown={onKeyDown}
      onDoubleClick={() => onChange(SPLIT_FRACTION_DEFAULT)}
      className={
        vertical
          ? "h-full w-1.5 shrink-0 cursor-col-resize touch-none bg-surface-root transition-colors duration-fast hover:bg-surface-hover active:bg-surface-selected [&::after]:mx-auto [&::after]:block [&::after]:h-full [&::after]:w-px [&::after]:bg-border-subtle [&::after]:content-['']"
          : "h-1.5 w-full shrink-0 cursor-row-resize touch-none bg-surface-root transition-colors duration-fast hover:bg-surface-hover active:bg-surface-selected [&::after]:my-auto [&::after]:block [&::after]:h-px [&::after]:w-full [&::after]:bg-border-subtle [&::after]:content-['']"
      }
    />
  );
}
