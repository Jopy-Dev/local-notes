import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import { CloseIcon } from "../icons";
import { IconButton } from "./IconButton";

/*
 * <Modal> per Design_System.md 9.1: native <dialog> for focus trap + Escape,
 * labelled title, focus returns to trigger on close. Width = layout-dialog (4.1).
 */
interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({ open, title, onClose, children, footer }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={onClose}
      className="w-[min(520px,calc(100vw-48px))] rounded-panel border border-border-strong bg-surface-panel p-0 text-text-primary shadow-popover"
    >
      <div className="flex min-h-12 items-center border-b border-border-subtle py-0 pr-3 pl-4.5">
        <h2 id={titleId} className="m-0 text-body font-heading">
          {title}
        </h2>
        <IconButton label="Close dialog" onClick={onClose} className="ml-auto">
          <CloseIcon size={16} />
        </IconButton>
      </div>
      <div className="p-4.5">{children}</div>
      {footer ? (
        <div className="flex justify-end gap-2 border-t border-border-subtle px-4.5 py-3.5">
          {footer}
        </div>
      ) : null}
    </dialog>
  );
}
