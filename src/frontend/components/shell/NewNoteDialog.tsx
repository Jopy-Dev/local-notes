import { useState } from "react";
import type { FormEvent } from "react";
import { ApiRequestError } from "../../services/api";
import { createNote } from "../../services/mutationsApi";
import { Button } from "../ui/Button";
import { FormField } from "../ui/FormField";
import { Input } from "../ui/Input";
import { Modal } from "../ui/Modal";
import { Select } from "../ui/Select";
import type { NoteMetadata } from "../../../shared/schemas/notes.js";

/*
 * Create-note dialog (WF-003): existing folders only, collision and
 * validation errors stay editable, no partial file on failure (REQ-011).
 */
const ROOT_LABEL = "Workspace root";

interface NewNoteDialogProps {
  open: boolean;
  folders: readonly string[];
  onClose: () => void;
  onCreated: (note: NoteMetadata) => void;
}

export function NewNoteDialog({ open, folders, onClose, onCreated }: NewNoteDialogProps) {
  const [filename, setFilename] = useState("untitled-note.md");
  const [folder, setFolder] = useState(ROOT_LABEL);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const folderOptions = [ROOT_LABEL, ...folders];

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const value = filename.trim();
    const extension = value.toLocaleLowerCase().endsWith(".txt") ? (".txt" as const) : (".md" as const);
    setSubmitting(true);
    setError(null);
    try {
      const created = await createNote({
        filename: value,
        extension,
        folderKey: folder === ROOT_LABEL ? "" : folder,
      });
      setFilename("untitled-note.md");
      onCreated(created);
    } catch (cause) {
      setError(
        cause instanceof ApiRequestError
          ? cause.message
          : "Could not create the note. Check the local server and retry.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Create note"
      description="Creates one file in an existing workspace folder."
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="new-note-form" loading={submitting}>
            Create and open
          </Button>
        </>
      }
    >
      <form id="new-note-form" noValidate onSubmit={(event) => void onSubmit(event)}>
        <FormField
          label="Filename"
          helper="Maximum 120 characters. Use .md or .txt."
          {...(error ? { error } : {})}
        >
          <Input
            value={filename}
            invalid={error !== null}
            onChange={(event) => setFilename(event.target.value)}
          />
        </FormField>
        <FormField label="Folder">
          <Select
            options={folderOptions}
            value={folder}
            onChange={(event) => setFolder(event.target.value)}
          />
        </FormField>
      </form>
    </Modal>
  );
}
