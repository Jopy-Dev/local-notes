import type { ReactNode } from "react";
import { ArchiveIcon, CheckCircleIcon, ClockIcon, FolderIcon, NewNoteIcon, NoteFileIcon, RefreshIcon } from "../icons";
import { FolderTree, TreeSection } from "../ui/FolderTree";
import type { TreeEntry } from "../ui/FolderTree";
import { IconButton } from "../ui/IconButton";
import { mockFolders, mockLibrary, WORKSPACE_PATH } from "../../services/mockWorkspace";
import type { MockFolderEntry } from "../../services/mockWorkspace";

/*
 * Folder navigation pane: library section, folders section, workspace footer.
 * Parity source: app-shell.html folders-pane.
 */
const iconFor: Record<MockFolderEntry["iconKind"], ReactNode> = {
  note: <NoteFileIcon size={15} strokeWidth={1.8} />,
  clock: <ClockIcon size={15} />,
  archive: <ArchiveIcon size={15} />,
  folder: <FolderIcon size={15} strokeWidth={1.8} />,
};

function toTreeEntries(entries: readonly MockFolderEntry[]): TreeEntry[] {
  return entries.map((entry) => ({
    key: entry.key,
    label: entry.label,
    count: entry.count,
    icon: iconFor[entry.iconKind],
    ...(entry.indent === true ? { indent: true } : {}),
  }));
}

interface FoldersPaneProps {
  activeKey: string;
  onSelect: (key: string) => void;
  onCreateNote: () => void;
  onRefresh: () => void;
}

export function FoldersPane({ activeKey, onSelect, onCreateNote, onRefresh }: FoldersPaneProps) {
  return (
    <aside
      aria-label="Workspace folders"
      className="flex h-full min-h-0 flex-col border-r border-border-subtle bg-surface-sidebar"
    >
      <div className="flex min-h-10 items-center gap-2 border-b border-border-subtle py-0 pr-2 pl-3">
        <span className="text-xs font-heading tracking-eyebrow text-text-muted uppercase">
          Workspace
        </span>
        <div className="ml-auto flex gap-0.5">
          <IconButton label="Create note" title="New note (Ctrl+N)" onClick={onCreateNote}>
            <NewNoteIcon size={16} />
          </IconButton>
          <IconButton label="Refresh workspace" onClick={onRefresh}>
            <RefreshIcon size={16} />
          </IconButton>
        </div>
      </div>
      <FolderTree label="Note navigation">
        <TreeSection entries={toTreeEntries(mockLibrary)} activeKey={activeKey} onSelect={onSelect} />
        <TreeSection
          title="Folders"
          entries={toTreeEntries(mockFolders)}
          activeKey={activeKey}
          onSelect={onSelect}
        />
      </FolderTree>
      <div className="border-t border-border-subtle p-2">
        <div
          title="Active local workspace"
          className="grid grid-cols-[24px_minmax(0,1fr)] items-center gap-2 rounded-control p-1.5 text-text-secondary hover:bg-surface-hover"
        >
          <span className="text-success">
            <CheckCircleIcon size={16} />
          </span>
          <div>
            <strong className="block truncate text-xs font-medium">Workspace available</strong>
            <span className="mt-0.5 block truncate font-mono text-2xs text-text-muted">
              {WORKSPACE_PATH}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
