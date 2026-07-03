import { useState } from "react";
import { ApiRequestError } from "../../services/api";
import { archiveNote } from "../../services/mutationsApi";
import { Button } from "../ui/Button";
import { FormField } from "../ui/FormField";
import { Input } from "../ui/Input";
import { Modal } from "../ui/Modal";

/*
 * Archive dialog (WF-009, REQ-013): explicit confirmation; a collision
 * offers rename-then-archive with REQ-011 validation server-side. The
 * active note never changes until the archive fully succeeds.
 */
interface ArchiveDialogProps {
  open: boolean;
  noteKey: string;
  noteTitle: string;
  onClose: () => void;
  onArchived: (archivedRelativePath: string) => void;
}

export function ArchiveDialog({ open, noteKey, noteTitle, onClose, onArchived }: ArchiveDialogProps) {
  const [collision, setCollision] = useState(false);
  const [replacement, setReplacement] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const result = await archiveNote(noteKey, collision ? replacement.trim() : undefined);
      setCollision(false);
      setReplacement("");
      onArchived(result.archivedRelativePath);
    } catch (cause) {
      if (cause instanceof ApiRequestError && cause.code === "ARCHIVE_COLLISION") {
        setCollision(true);
        setError("An archived note already has this name. Rename to archive.");
      } else {
        setError(
          cause instanceof ApiRequestError
            ? cause.message
            : "Could not archive the note. Check the local server and retry.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Archive note"
      description={`Moves "${noteTitle}" into the workspace archive. Nothing is deleted.`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="danger"
            loading={submitting}
            disabled={collision && replacement.trim().length === 0}
            onClick={() => void submit()}
          >
            {collision ? "Rename then archive" : "Archive note"}
          </Button>
        </>
      }
    >
      {collision ? (
        <FormField
          label="New filename"
          helper="Maximum 120 characters. Use .md or .txt."
          {...(error ? { error } : {})}
        >
          <Input
            value={replacement}
            invalid={error !== null}
            onChange={(event) => setReplacement(event.target.value)}
          />
        </FormField>
      ) : (
        <p className="text-sm text-text-secondary">
          The note keeps its folder structure under the archive and stays an ordinary file.
          {error ? <span className="mt-2 block text-danger">{error}</span> : null}
        </p>
      )}
    </Modal>
  );
}
