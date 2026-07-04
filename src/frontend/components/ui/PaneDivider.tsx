import { useRef } from "react";
import type { KeyboardEvent, PointerEvent } from "react";

/*
 * <PaneDivider> per Design_System.md 9.2 (REQ-034, WF-012): vertical
 * separator between workspace panes. Drag resizes live and commits on
 * release; keyboard resizes in 8px steps (Home/End snap to min/max) and
 * commits per step. Disabled below the desktop breakpoint - rendered for
 * layout continuity but inert. Reuses border/focus tokens only.
 */
const KEY_STEP_PX = 8;

interface PaneDividerProps {
  pane: "folder" | "notes";
  width: number;
  min: number;
  max: number;
  disabled?: boolean;
  onResize: (width: number) => void;
  onCommit: (width: number) => void;
  /* Enter/Space or double-click collapses/restores the pane (REQ-034). */
  onToggleCollapse?: () => void;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function PaneDivider({
  pane,
  width,
  min,
  max,
  disabled = false,
  onResize,
  onCommit,
  onToggleCollapse,
}: PaneDividerProps) {
  const drag = useRef<{ pointerId: number; startX: number; startWidth: number } | null>(null);

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (disabled) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointerId: event.pointerId, startX: event.clientX, startWidth: width };
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current || event.pointerId !== drag.current.pointerId) return;
    onResize(clamp(drag.current.startWidth + (event.clientX - drag.current.startX), min, max));
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current || event.pointerId !== drag.current.pointerId) return;
    const next = clamp(drag.current.startWidth + (event.clientX - drag.current.startX), min, max);
    drag.current = null;
    onCommit(next);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;
    if ((event.key === "Enter" || event.key === " ") && onToggleCollapse) {
      event.preventDefault();
      onToggleCollapse();
      return;
    }
    let next: number | null = null;
    if (event.key === "ArrowLeft") next = clamp(width - KEY_STEP_PX, min, max);
    if (event.key === "ArrowRight") next = clamp(width + KEY_STEP_PX, min, max);
    if (event.key === "Home") next = min;
    if (event.key === "End") next = max;
    if (next === null || next === width) return;
    event.preventDefault();
    onResize(next);
    onCommit(next);
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={pane === "folder" ? "Resize folder pane" : "Resize note list pane"}
      aria-valuenow={width}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      title={disabled ? undefined : "Drag or use arrow keys to resize. Press Enter to collapse."}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onKeyDown={onKeyDown}
      onDoubleClick={disabled ? undefined : onToggleCollapse}
      className={
        disabled
          ? "h-full w-1.5 shrink-0 bg-surface-root [&::after]:mx-auto [&::after]:block [&::after]:h-full [&::after]:w-px [&::after]:bg-border-subtle [&::after]:content-['']"
          : "h-full w-1.5 shrink-0 cursor-col-resize touch-none bg-surface-root transition-colors duration-fast hover:bg-surface-hover active:bg-surface-selected [&::after]:mx-auto [&::after]:block [&::after]:h-full [&::after]:w-px [&::after]:bg-border-subtle [&::after]:content-['']"
      }
    />
  );
}
