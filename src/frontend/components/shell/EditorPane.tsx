import { FocusEnterIcon, FocusExitIcon, NoteFileIcon } from "../icons";
import { Button } from "../ui/Button";
import { ConflictPanel } from "../ui/ConflictPanel";
import { EditorHeader } from "../ui/EditorHeader";
import { FindInNoteBar } from "../ui/FindInNoteBar";
import type { FindController } from "../ui/FindInNoteBar";
import { EditorModeTabs } from "../ui/EditorModeTabs";
import type { EditorMode } from "../ui/EditorModeTabs";
import { IconButton } from "../ui/IconButton";
import { ReadOnlyBanner } from "../ui/ReadOnlyBanner";
import { SaveState } from "../ui/SaveState";
import type { SaveStateKind } from "../ui/SaveState";
import { EditorContent } from "./EditorContent";
import type { SplitLayout } from "./EditorContent";
import { NoteActionsMenu } from "./NoteActionsMenu";
import type { NoteDocument } from "../../../shared/schemas/notes.js";

/*
 * Editor pane composition (SCREEN-002, WF-005/006/007): header + read-only /
 * conflict banners + live CodeMirror workspace. Focus Mode preserves this
 * pane in full (Design_System.md layout-focus). No note open = explicit
 * empty state, never a mock document.
 */
interface EditorPaneProps {
  document: NoteDocument | null;
  draft: string;
  saveState: SaveStateKind;
  conflict: "changed" | "source-missing" | null;
  readOnlyReason: "oversized" | "encoding" | null;
  loadError: string | null;
  onChangeDraft: (value: string) => void;
  onRetrySave: () => void;
  onResolveReload: () => void;
  onResolveOverwrite: () => void;
  onSaveAsNew: () => void;
  onCloseWithoutSaving: () => void;
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
  visualCompatibility: "edit" | "source-only";
  visualCompatibilityReason: string | null;
  splitLayout: SplitLayout;
  onCycleSplitLayout: () => void;
  focusMode: boolean;
  onToggleFocusMode: () => void;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  find: FindController;
  onOpenFind: () => void;
  onToast: (message: string) => void;
  onCopyMarkdown: () => void;
  onCopyText: () => void;
  onCopyLocalPath: () => void;
  onMoveNote: () => void;
  onArchiveNote: () => void;
}

function EmptyEditor({ message }: { message: string }) {
  return (
    <main className="grid h-full min-h-0 place-items-center bg-surface-editor p-6">
      <div className="text-center text-text-secondary">
        <span className="inline-block text-text-muted">
          <NoteFileIcon size={24} />
        </span>
        <p className="mt-2.5 max-w-sm text-sm leading-relaxed">{message}</p>
      </div>
    </main>
  );
}

export function EditorPane(props: EditorPaneProps) {
  const { document } = props;
  if (props.loadError) return <EmptyEditor message={props.loadError} />;
  if (!document) {
    return <EmptyEditor message="Select a note from the list or create a new one to start writing." />;
  }

  const breadcrumbs = [
    "Workspace",
    ...document.folder.split("/").filter(Boolean),
    document.filename,
  ];
  const modes: readonly EditorMode[] =
    document.extension === ".md" ? ["read", "edit", "source", "split"] : ["edit"];
  const splitLayoutLabel: Record<SplitLayout, string> = {
    side: "Side by side",
    "preview-top": "Preview above",
    "preview-bottom": "Preview below",
  };

  return (
    <main className="flex h-full min-h-0 flex-col bg-surface-editor">
      <EditorHeader
        breadcrumbs={breadcrumbs}
        title={document.title}
        readOnlyTitle
        actions={
          <>
            <SaveState state={props.saveState} compactHideText />
            {props.saveState === "error" ? (
              <Button size="sm" onClick={props.onRetrySave}>
                Retry save
              </Button>
            ) : null}
            {modes.length > 1 ? (
              <EditorModeTabs mode={props.mode} onChange={props.onModeChange} modes={modes} />
            ) : null}
            {props.mode === "split" && document.extension === ".md" ? (
              <Button
                size="sm"
                title="Cycle split layout"
                onClick={props.onCycleSplitLayout}
              >
                {splitLayoutLabel[props.splitLayout]}
              </Button>
            ) : null}
            <IconButton
              label={props.focusMode ? "Exit focus mode" : "Enter focus mode"}
              title={props.focusMode ? "Exit focus mode (Ctrl+Shift+F)" : "Focus mode (Ctrl+Shift+F)"}
              pressed={props.focusMode}
              onClick={props.onToggleFocusMode}
            >
              {props.focusMode ? <FocusExitIcon size={16} /> : <FocusEnterIcon size={16} />}
            </IconButton>
            <NoteActionsMenu
              open={props.menuOpen}
              noteSelected
              markdownNote={document.extension === ".md"}
              onToggle={props.onToggleMenu}
              onClose={props.onCloseMenu}
              onCopyMarkdown={props.onCopyMarkdown}
              onCopyText={props.onCopyText}
              onCopyLocalPath={props.onCopyLocalPath}
              onMoveNote={props.onMoveNote}
              onArchiveNote={props.onArchiveNote}
            />
          </>
        }
      />
      {props.find.open ? (
        <FindInNoteBar
          query={props.find.query}
          caseSensitive={props.find.caseSensitive}
          activeIndex={props.find.activeIndex}
          total={props.find.total}
          onQueryChange={props.find.onQueryChange}
          onToggleCase={props.find.onToggleCase}
          onNext={props.find.onNext}
          onPrevious={props.find.onPrevious}
          onClose={props.find.onClose}
        />
      ) : null}
      {props.readOnlyReason ? <ReadOnlyBanner reason={props.readOnlyReason} /> : null}
      <ConflictPanel
        kind={props.conflict}
        onReload={props.onResolveReload}
        onKeepDraft={props.onResolveOverwrite}
        onSaveAsNew={props.onSaveAsNew}
        onCloseWithoutSaving={props.onCloseWithoutSaving}
      />
      <div className="grid min-h-0 flex-1">
        <EditorContent
          mode={document.extension === ".md" ? props.mode : "edit"}
          document={document}
          draft={props.draft}
          readOnly={props.readOnlyReason !== null || props.conflict !== null}
          visualCompatibility={props.visualCompatibility}
          visualCompatibilityReason={props.visualCompatibilityReason}
          splitLayout={props.splitLayout}
          onChangeDraft={props.onChangeDraft}
          onToast={props.onToast}
          find={props.find.request}
          onFindMatches={props.find.onMatches}
          onOpenFind={props.onOpenFind}
        />
      </div>
    </main>
  );
}
