import { FolderAddIcon } from "./icons";
import { Button } from "./ui/Button";
import { Modal } from "./ui/Modal";

/*
 * Workspace chooser dialog for the launch surface. Mock interaction at
 * Step 11 - the production app opens the native folder picker (Step 12+).
 */
interface WorkspaceDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function WorkspaceDialog({ open, onClose, onConfirm }: WorkspaceDialogProps) {
  return (
    <Modal
      open={open}
      title="Choose workspace"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={onConfirm}>
            Open folder
          </Button>
        </>
      }
    >
      <p className="m-0 mb-3.5 leading-normal text-text-secondary">
        Prototype interaction: the production app opens the native folder picker. Files remain in
        the selected local directory.
      </p>
      <div className="flex items-center gap-2.5 rounded-control border border-border-subtle bg-surface-root px-3 py-2.5">
        <span className="shrink-0 text-accent">
          <FolderAddIcon size={17} />
        </span>
        <div className="min-w-0">
          <strong className="block text-sm text-text-primary">Default workspace</strong>
          <code className="mt-1 block truncate font-mono text-xs text-text-muted">
            ~/.local-notes
          </code>
        </div>
      </div>
    </Modal>
  );
}
