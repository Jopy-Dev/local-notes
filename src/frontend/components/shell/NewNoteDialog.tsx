import { useState } from "react";
import type { FormEvent } from "react";
import { Button } from "../ui/Button";
import { FormField } from "../ui/FormField";
import { Input } from "../ui/Input";
import { Modal } from "../ui/Modal";
import { Select } from "../ui/Select";

/*
 * Create-note dialog (WF-003 surface). Validation mirrors REQ-011 shape
 * (extension + reserved characters + 120-char cap); real create API at Step 12+.
 */
const FOLDER_OPTIONS = ["Projects / Local Notes", "Daily", "Research", "Reference"] as const;
const MAX_FILENAME = 120;

function isValidFilename(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= MAX_FILENAME &&
    /\.(md|txt)$/i.test(value) &&
    !/[\\/:*?"<>|]/.test(value)
  );
}

interface NewNoteDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (filename: string) => void;
}

export function NewNoteDialog({ open, onClose, onCreate }: NewNoteDialogProps) {
  const [filename, setFilename] = useState("untitled-note.md");
  const [invalid, setInvalid] = useState(false);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const value = filename.trim();
    if (!isValidFilename(value)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    onCreate(value);
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
          <Button variant="primary" type="submit" form="new-note-form">
            Create and open
          </Button>
        </>
      }
    >
      <form id="new-note-form" noValidate onSubmit={onSubmit}>
        <FormField
          label="Filename"
          helper="Maximum 120 characters. Use .md or .txt."
          {...(invalid ? { error: "Enter a unique filename ending in .md or .txt." } : {})}
        >
          <Input
            value={filename}
            invalid={invalid}
            onChange={(event) => setFilename(event.target.value)}
          />
        </FormField>
        <FormField label="Folder">
          <Select options={FOLDER_OPTIONS} />
        </FormField>
      </form>
    </Modal>
  );
}
