import type { RefObject } from "react";
import { SearchEmptyIcon } from "../icons";
import { DashboardToolbar } from "../ui/DashboardToolbar";
import { NoteListItem } from "../ui/NoteListItem";
import type { NoteListEntry } from "../ui/NoteListItem";
import { SORT_OPTIONS, TOTAL_NOTES } from "../../services/mockWorkspace";

/*
 * Note list pane: toolbar + filtered list + no-result state (WF-001/002).
 * Parity source: app-shell.html notes-pane. Virtualization arrives with real
 * data at Step 12+ (10,000-note support).
 */
interface NotesPaneProps {
  notes: readonly NoteListEntry[];
  selectedKey: string;
  onSelect: (key: string) => void;
  query: string;
  onQueryChange: (value: string) => void;
  descending: boolean;
  onToggleDirection: () => void;
  searchRef: RefObject<HTMLInputElement | null>;
}

export function NotesPane({
  notes,
  selectedKey,
  onSelect,
  query,
  onQueryChange,
  descending,
  onToggleDirection,
  searchRef,
}: NotesPaneProps) {
  const resultCount = query
    ? `${notes.length} result${notes.length === 1 ? "" : "s"}`
    : `${TOTAL_NOTES} notes`;

  return (
    <section
      aria-label="Notes"
      className="flex h-full min-h-0 flex-col border-r border-border-subtle bg-surface-panel"
    >
      <DashboardToolbar
        query={query}
        onQueryChange={(event) => onQueryChange(event.target.value)}
        resultCount={resultCount}
        sortOptions={SORT_OPTIONS}
        descending={descending}
        onToggleDirection={onToggleDirection}
        searchRef={searchRef}
      />
      <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-color:var(--color-border-strong)_transparent] [scrollbar-width:thin]">
        {notes.map((note) => (
          <NoteListItem
            key={note.key}
            note={note}
            selected={note.key === selectedKey}
            onSelect={onSelect}
          />
        ))}
        {notes.length === 0 ? (
          <div className="px-5.5 py-8 text-center text-text-secondary">
            <span className="inline-block text-text-muted">
              <SearchEmptyIcon size={22} />
            </span>
            <strong className="mt-2.5 block text-ui">No matching notes</strong>
            <span className="mt-1 block text-xs text-text-muted">
              Try a filename, phrase, or nearby spelling.
            </span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
