import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ArchiveIcon, CopyIcon, MoreIcon, MoveNoteIcon, TrashIcon } from "../icons";
import { MarkdownPreview } from "../../editor/MarkdownPreview";
import { SourceEditor } from "../../editor/SourceEditor";
import { copyPlainText, copyToClipboard } from "../../editor/copy-actions";
import { ApiRequestError } from "../../services/api";
import { deleteArchivedNote, loadArchivedNote, restoreArchivedNote } from "../../services/archiveApi";
import { navigate } from "../../services/navigation";
import { getWorkspaceDisplayPath } from "../../services/workspace";
import { useWorkspaceData } from "../../stores/workspaceData";
import { Button } from "../ui/Button";
import { ConfirmationDialog } from "../ui/ConfirmationDialog";
import { EditorHeader } from "../ui/EditorHeader";
import { FormField } from "../ui/FormField";
import { IconButton } from "../ui/IconButton";
import { Modal } from "../ui/Modal";
import { MenuButton, MenuSeparator, Popover } from "../ui/Popover";
import { Select } from "../ui/Select";
import type { NoteDocument } from "../../../shared/schemas/notes.js";

/*
 * Archived note surface (round 2, SCREEN-008): content is read-only - no
 * editor state machine, no save pipeline. Actions: restore into an existing
 * active folder (mirror of move), the copy set, and Delete, which sends the
 * file to the OS recycle bin after explicit confirmation (ADR-009).
 */
const ROOT_LABEL = "Workspace root";

interface ArchiveNoteViewProps {
  noteKey: string;
  folders: readonly string[];
  onToast: (message: string) => void;
}

type ArchiveDialog = "restore" | "delete" | null;

export function ArchiveNoteView({ noteKey, folders, onToast }: ArchiveNoteViewProps) {
  const [document, setDocument] = useState<NoteDocument | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialog, setDialog] = useState<ArchiveDialog>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setDocument(null);
    setLoadError(null);
    loadArchivedNote(noteKey)
      .then((loaded) => {
        if (!cancelled) setDocument(loaded);
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError("This archived note could not be loaded. It may have been moved or removed.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [noteKey]);

  function copyWithToast(action: Promise<boolean>, successMessage: string) {
    void action.then((copied) =>
      onToast(copied ? successMessage : "Copy failed - clipboard unavailable"),
    );
  }

  function copyLocalPath() {
    if (!document) return;
    const root = getWorkspaceDisplayPath();
    const relative = `save-data/archive/${document.relativePath}`;
    copyWithToast(copyToClipboard(root ? `${root}/${relative}` : relative), "Local path copied");
  }

  async function onDelete() {
    if (!document) return;
    setBusy(true);
    try {
      await deleteArchivedNote(noteKey);
      onToast(`Moved ${document.filename} to the Recycle Bin`);
      setDialog(null);
      // Archive tree is not watched - refresh the scoped list explicitly.
      void useWorkspaceData.getState().loadInitial();
      navigate("/");
    } catch {
      onToast("Delete failed - the note is unchanged");
      setDialog(null);
    } finally {
      setBusy(false);
    }
  }

  if (loadError) {
    return (
      <main className="grid h-full min-h-0 place-items-center bg-surface-editor p-6">
        <p className="max-w-sm text-center text-sm leading-relaxed text-text-secondary">{loadError}</p>
      </main>
    );
  }
  if (!document) {
    return <main aria-busy="true" className="h-full min-h-0 bg-surface-editor" />;
  }

  const breadcrumbs = ["Archive", ...document.folder.split("/").filter(Boolean), document.filename];

  return (
    <main className="flex h-full min-h-0 flex-col bg-surface-editor">
      <EditorHeader
        breadcrumbs={breadcrumbs}
        title={document.title}
        readOnlyTitle
        actions={
          <div className="relative">
            <IconButton
              label="More note actions"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <MoreIcon size={16} />
            </IconButton>
            <Popover open={menuOpen} onClose={() => setMenuOpen(false)}>
              <MenuButton
                icon={<MoveNoteIcon size={14} />}
                onClick={() => {
                  setMenuOpen(false);
                  setDialog("restore");
                }}
              >
                Move note
              </MenuButton>
              {document.extension === ".md" ? (
                <MenuButton
                  icon={<CopyIcon size={14} />}
                  onClick={() => {
                    setMenuOpen(false);
                    copyWithToast(copyToClipboard(document.content), "Markdown copied");
                  }}
                >
                  Copy Markdown
                </MenuButton>
              ) : null}
              <MenuButton
                icon={<CopyIcon size={14} />}
                onClick={() => {
                  setMenuOpen(false);
                  copyWithToast(
                    copyPlainText(document.content, document.noteKey, document.extension),
                    "Text copied",
                  );
                }}
              >
                Copy Text
              </MenuButton>
              <MenuButton
                icon={<CopyIcon size={14} />}
                onClick={() => {
                  setMenuOpen(false);
                  copyLocalPath();
                }}
              >
                Copy local path
              </MenuButton>
              <MenuSeparator />
              <MenuButton
                danger
                icon={<TrashIcon size={14} />}
                onClick={() => {
                  setMenuOpen(false);
                  setDialog("delete");
                }}
              >
                Delete
              </MenuButton>
            </Popover>
          </div>
        }
      />
      <div
        role="status"
        className="flex items-center gap-2 border-b border-border-subtle bg-surface-panel px-3 py-1.5 text-xs text-info"
      >
        <ArchiveIcon size={14} />
        <span>Archived note - read-only. Move it back to a folder to edit.</span>
      </div>
      <div className="grid min-h-0 flex-1">
        {document.extension === ".md" ? (
          <MarkdownPreview source={document.content} noteKey={document.noteKey} onToast={onToast} />
        ) : (
          <SourceEditor
            value={document.content}
            language="plain"
            readOnly
            onChange={() => undefined}
          />
        )}
      </div>
      <RestorePanel
        open={dialog === "restore"}
        noteKey={noteKey}
        noteTitle={document.title}
        folders={folders}
        onClose={() => setDialog(null)}
        onToast={onToast}
      />
      <ConfirmationDialog
        open={dialog === "delete"}
        title="Delete archived note?"
        details={`"${document.filename}" moves to the system Recycle Bin. Local-Notes never deletes files permanently itself, but emptying the Recycle Bin will.`}
        confirmLabel={busy ? "Deleting..." : "Delete"}
        onConfirm={() => void onDelete()}
        onClose={() => setDialog(null)}
      />
    </main>
  );
}

function RestorePanel({
  open,
  noteKey,
  noteTitle,
  folders,
  onClose,
  onToast,
}: {
  open: boolean;
  noteKey: string;
  noteTitle: string;
  folders: readonly string[];
  onClose: () => void;
  onToast: (message: string) => void;
}) {
  const [destination, setDestination] = useState(ROOT_LABEL);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const restored = await restoreArchivedNote(
        noteKey,
        destination === ROOT_LABEL ? "" : destination,
      );
      onToast(`Restored ${restored.filename}`);
      navigate(`/notes/${restored.noteKey}`);
    } catch (cause) {
      setError(
        cause instanceof ApiRequestError
          ? cause.message
          : "Could not restore the note. Check the local server and retry.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Move note"
      description={`Moves "${noteTitle}" out of the archive into an existing folder. Content stays unchanged.`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="restore-note-form" loading={submitting}>
            Move note
          </Button>
        </>
      }
    >
      <form id="restore-note-form" noValidate onSubmit={(event) => void onSubmit(event)}>
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
