import type { RefObject } from "react";
import { NewNoteIcon, SearchEmptyIcon } from "../icons";
import { Button } from "../ui/Button";
import { DashboardToolbar } from "../ui/DashboardToolbar";
import { NoteCard } from "../ui/NoteCard";
import { NoteListItem } from "../ui/NoteListItem";
import type { NoteListEntry } from "../ui/NoteListItem";
import { NoteListSkeleton } from "../ui/Skeleton";
import { SORT_OPTIONS } from "../../services/mockWorkspace";

/*
 * Note list pane (WF-001/002/004): toolbar + list/card views + skeleton +
 * empty/no-result states + load-more batches. Virtualization upgrade rides
 * with the 10k perf pass (REQ-031 evidence at Wave 8).
 */
interface NotesPaneProps {
  notes: readonly NoteListEntry[];
  selectedKey: string;
  onSelect: (key: string) => void;
  query: string;
  onQueryChange: (value: string) => void;
  descending: boolean;
  onToggleDirection: () => void;
  view: "list" | "card";
  onViewChange: (view: "list" | "card") => void;
  loading: boolean;
  totalLabel: string;
  hasMore: boolean;
  onLoadMore: () => void;
  onCreateNote: () => void;
  searchRef: RefObject<HTMLInputElement | null>;
}

function EmptyState({ query, onCreateNote }: { query: string; onCreateNote: () => void }) {
  if (query) {
    return (
      <div className="px-5.5 py-8 text-center text-text-secondary">
        <span className="inline-block text-text-muted">
          <SearchEmptyIcon size={22} />
        </span>
        <strong className="mt-2.5 block text-ui">No matching notes</strong>
        <span className="mt-1 block text-xs text-text-muted">
          Try a filename, phrase, or nearby spelling.
        </span>
      </div>
    );
  }
  return (
    <div className="px-5.5 py-8 text-center text-text-secondary">
      <strong className="block text-ui">No notes yet</strong>
      <span className="mt-1 block text-xs text-text-muted">
        Create your first note - it becomes an ordinary file in your workspace.
      </span>
      <Button variant="primary" size="sm" className="mt-3" onClick={onCreateNote}>
        <NewNoteIcon size={15} />
        Create note
      </Button>
    </div>
  );
}

export function NotesPane(props: NotesPaneProps) {
  const { notes, loading, view } = props;

  return (
    <section
      aria-label="Notes"
      className="flex h-full min-h-0 flex-col border-r border-border-subtle bg-surface-panel"
    >
      <DashboardToolbar
        query={props.query}
        onQueryChange={(event) => props.onQueryChange(event.target.value)}
        resultCount={props.totalLabel}
        sortOptions={SORT_OPTIONS}
        descending={props.descending}
        onToggleDirection={props.onToggleDirection}
        view={view}
        onViewChange={props.onViewChange}
        searchRef={props.searchRef}
      />
      <div
        aria-busy={loading || undefined}
        className="min-h-0 flex-1 overflow-y-auto [scrollbar-color:var(--color-border-strong)_transparent] [scrollbar-width:thin]"
      >
        {loading ? <NoteListSkeleton /> : null}
        {!loading && view === "list"
          ? notes.map((note) => (
              <NoteListItem
                key={note.key}
                note={note}
                selected={note.key === props.selectedKey}
                onSelect={props.onSelect}
              />
            ))
          : null}
        {!loading && view === "card" ? (
          <div className="grid grid-cols-2 gap-2 p-2">
            {notes.map((note) => (
              <NoteCard
                key={note.key}
                note={note}
                selected={note.key === props.selectedKey}
                onSelect={props.onSelect}
              />
            ))}
          </div>
        ) : null}
        {!loading && notes.length === 0 ? (
          <EmptyState query={props.query} onCreateNote={props.onCreateNote} />
        ) : null}
        {!loading && props.hasMore ? (
          <div className="p-2">
            <Button size="sm" className="w-full" onClick={props.onLoadMore}>
              Load more
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
