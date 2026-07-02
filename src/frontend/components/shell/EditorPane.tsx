import type { ChangeEventHandler } from "react";
import { FocusEnterIcon, FocusExitIcon } from "../icons";
import { ConflictPanel } from "../ui/ConflictPanel";
import { EditorHeader } from "../ui/EditorHeader";
import { EditorModeTabs } from "../ui/EditorModeTabs";
import type { EditorMode } from "../ui/EditorModeTabs";
import { IconButton } from "../ui/IconButton";
import { SaveState } from "../ui/SaveState";
import type { SaveStateKind } from "../ui/SaveState";
import { EditorContent } from "./EditorContent";
import { NoteActionsMenu } from "./NoteActionsMenu";
import { mockBreadcrumbs } from "../../services/mockWorkspace";

/*
 * Editor pane composition: header + conflict banner + workspace (SCREEN-002).
 * Focus Mode preserves this pane in full (Design_System.md layout-focus).
 */
interface EditorPaneProps {
  title: string;
  onTitleChange: ChangeEventHandler<HTMLInputElement>;
  saveState: SaveStateKind;
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
  focusMode: boolean;
  onToggleFocusMode: () => void;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onMenuAction: (message: string) => void;
  conflictVisible: boolean;
  onShowConflict: () => void;
  onResolveConflict: (message: string) => void;
}

export function EditorPane(props: EditorPaneProps) {
  return (
    <main className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] bg-surface-editor">
      <EditorHeader
        breadcrumbs={mockBreadcrumbs}
        title={props.title}
        onTitleChange={props.onTitleChange}
        actions={
          <>
            <SaveState state={props.saveState} compactHideText />
            <EditorModeTabs mode={props.mode} onChange={props.onModeChange} />
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
              onToggle={props.onToggleMenu}
              onClose={props.onCloseMenu}
              onAction={props.onMenuAction}
              onPreviewConflict={props.onShowConflict}
            />
          </>
        }
      />
      <ConflictPanel
        visible={props.conflictVisible}
        onReload={() => props.onResolveConflict("Disk version loaded")}
        onKeepDraft={() => props.onResolveConflict("Draft saved over disk version")}
      />
      <EditorContent mode={props.mode} />
    </main>
  );
}
