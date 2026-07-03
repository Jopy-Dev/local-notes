import { useState } from "react";
import type { FormEvent } from "react";
import { ApiRequestError } from "../../services/api";
import { moveNote } from "../../services/mutationsApi";
import { Button } from "../ui/Button";
import { FormField } from "../ui/FormField";
import { Modal } from "../ui/Modal";
import { Select } from "../ui/Select";
import type { NoteMetadata } from "../../../shared/schemas/notes.js";

/*
 * Move-note panel (WF-008, REQ-012): one note to an existing folder;
 * collision leaves the source unchanged and the panel editable.
 */
const ROOT_LABEL = "Workspace root";

interface MoveNotePanelProps {
  open: boolean;
  noteKey: string;
  noteTitle: string;
  folders: readonly string[];
  onClose: () => void;
  onMoved: (note: NoteMetadata) => void;
}

export function MoveNotePanel({ open, noteKey, noteTitle, folders, onClose, onMoved }: MoveNotePanelProps) {
  const [destination, setDestination] = useState(ROOT_LABEL);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const moved = await moveNote(noteKey, destination === ROOT_LABEL ? "" : destination);
      onMoved(moved);
    } catch (cause) {
      setError(
        cause instanceof ApiRequestError
          ? cause.message
          : "Could not move the note. Check the local server and retry.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Move note"
      description={`Moves "${noteTitle}" to an existing folder. Content stays unchanged.`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="move-note-form" loading={submitting}>
            Move note
          </Button>
        </>
      }
    >
      <form id="move-note-form" noValidate onSubmit={(event) => void onSubmit(event)}>
        <FormField label="Destination folder" {...(error ? { error } : {})}>
          <Select
            options={[ROOT_LABEL, ...folders]}
            value={destination}
            onChange={(event) => setDestination(event.target.value)}
          />
        </FormField>
      </form>
    </Modal>
  );
}
