import { StatusBar, StatusItem, StatusSpacer } from "../ui/StatusBar";
import type { SaveStateKind } from "../ui/SaveState";
import type { NoteDocument } from "../../../shared/schemas/notes.js";

/*
 * Shell status strip (SCREEN-002): live save state, path, and file facts.
 * Editor font size joins when settings wire up at Wave 7.
 */
const SAVE_DOT: Record<SaveStateKind, "success" | "warning" | "danger"> = {
  saved: "success",
  unsaved: "warning",
  saving: "warning",
  conflict: "danger",
  error: "danger",
};

const ENCODING_LABEL: Record<string, string> = {
  utf8: "UTF-8",
  "utf8-bom": "UTF-8 BOM",
  unsupported: "Unsupported encoding",
};

const SAVE_LABEL: Record<SaveStateKind, string> = {
  saved: "Saved",
  unsaved: "Unsaved",
  saving: "Saving...",
  conflict: "Conflict",
  error: "Save error",
};

interface ShellStatusBarProps {
  document: NoteDocument | null;
  saveState: SaveStateKind;
}

export function ShellStatusBar({ document, saveState }: ShellStatusBarProps) {
  return (
    <StatusBar>
      {document ? (
        <>
          <StatusItem dot={SAVE_DOT[saveState]}>{SAVE_LABEL[saveState]}</StatusItem>
          <StatusItem mono>{document.relativePath}</StatusItem>
          <StatusSpacer />
          <StatusItem>{document.extension === ".md" ? "Markdown" : "Plain text"}</StatusItem>
          <StatusItem>{ENCODING_LABEL[document.textEncoding] ?? "UTF-8"}</StatusItem>
          <StatusItem>{document.lineEnding === "crlf" ? "CRLF" : "LF"}</StatusItem>
          <StatusItem>Local only</StatusItem>
        </>
      ) : (
        <>
          <StatusItem dot="success">Workspace ready</StatusItem>
          <StatusSpacer />
          <StatusItem>Local only</StatusItem>
        </>
      )}
    </StatusBar>
  );
}
