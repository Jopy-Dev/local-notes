import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

/*
 * <Popover> per Design_System.md 9.1: trigger owns aria-expanded (caller),
 * Escape/outside click close, focus behavior stays on trigger side.
 * Menu-style content for note actions.
 */
interface PopoverProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function Popover({ open, onClose, children }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(event: MouseEvent) {
      if (ref.current && !ref.current.parentElement?.contains(event.target as Node)) {
        onClose();
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      role="menu"
      className="absolute top-8.5 right-0 z-(--z-dropdown) w-49 rounded-panel border border-border-strong bg-surface-raised p-1 shadow-popover"
    >
      {children}
    </div>
  );
}

interface MenuButtonProps {
  icon: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}

export function MenuButton({ icon, danger = false, disabled = false, onClick, children }: MenuButtonProps) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={[
        "flex min-h-8 w-full items-center gap-2 rounded-control border-0 bg-transparent px-2 text-left text-ui",
        disabled
          ? "cursor-default text-text-disabled"
          : danger
            ? "cursor-pointer text-danger hover:bg-surface-hover hover:text-text-primary"
            : "cursor-pointer text-text-secondary hover:bg-surface-hover hover:text-text-primary",
      ].join(" ")}
    >
      <span className="shrink-0">{icon}</span>
      {children}
    </button>
  );
}

export function MenuSeparator() {
  return <div role="separator" className="m-1 h-px bg-border-subtle" />;
}
