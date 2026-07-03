import { useEffect, useRef } from "react";
import { Button } from "./Button";
import { Modal } from "./Modal";

/*
 * <ConfirmationDialog> per Design_System.md 9.2: explicit consequence before
 * a destructive or irreversible action (reload over draft, discard draft,
 * archive). Initial focus lands on the safe action (Cancel), never on the
 * destructive one.
 */
interface ConfirmationDialogProps {
  open: boolean;
  title: string;
  details: string;
  tone?: "default" | "destructive";
  confirmLabel: string;
  cancelLabel?: string;
  submitting?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmationDialog({
  open,
  title,
  details,
  tone = "default",
  confirmLabel,
  cancelLabel = "Cancel",
  submitting = false,
  error = null,
  onConfirm,
  onClose,
}: ConfirmationDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Safe-action initial focus: after the native dialog opens and moves focus
  // itself, pull it onto Cancel so Enter never triggers the consequence.
  useEffect(() => {
    if (open) requestAnimationFrame(() => cancelRef.current?.focus());
  }, [open]);

  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button ref={cancelRef} onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === "destructive" ? "danger" : "primary"}
            loading={submitting}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-text-secondary">
        {details}
        {error ? <span className="mt-2 block text-danger">{error}</span> : null}
      </p>
    </Modal>
  );
}
