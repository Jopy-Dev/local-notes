import type { ReactNode } from "react";
import { CheckIcon } from "../icons";

/*
 * <Toast> per Design_System.md 9.1: role=status, token motion, success tone
 * for local operation feedback. Visibility owned by caller (2200ms target, 7).
 */
interface ToastProps {
  visible: boolean;
  children: ReactNode;
}

export function Toast({ visible, children }: ToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      data-visible={visible}
      className={[
        "fixed right-4.5 bottom-10 z-(--z-toast) flex max-w-90 items-center gap-2",
        "rounded-control border border-border-strong bg-surface-raised px-3 py-2.5",
        "text-text-primary shadow-popover",
        "transition-[opacity,transform] duration-(--duration-standard) ease-standard",
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0",
      ].join(" ")}
    >
      <span className="text-success">
        <CheckIcon size={16} />
      </span>
      {children}
    </div>
  );
}
