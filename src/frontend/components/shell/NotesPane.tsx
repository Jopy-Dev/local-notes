import { useRef } from "react";
import type { RefObject } from "react";
import { NewNoteIcon, SearchEmptyIcon, WarningIcon } from "../icons";
import { Button } from "../ui/Button";
import { DashboardToolbar } from "../ui/DashboardToolbar";
import type { NoteListEntry } from "../ui/NoteListItem";
import { NotesVirtualList } from "../ui/NotesVirtualList";
import { SearchResultItem } from "../ui/SearchResultItem";
import { NoteListSkeleton } from "../ui/Skeleton";
import type { DashboardSortBy } from "../../stores/workspaceData";
import type { SearchStatus } from "../../stores/searchData";
import type { IndexState, SearchResult } from "../../../shared/schemas/search.js";

/*
 * Note list pane (WF-001/002/004): toolbar + virtualized list (REQ-031
 * incremental rendering) + skeleton + empty/no-result states + load-more
 * batches. Non-blank queries render ranked search results (REQ-009); a
 * degraded index links the recovery surface.
 */
interface NotesPaneProps {
  notes: readonly NoteListEntry[];
  selectedKey: string;
  onSelect: (key: string) => void;
  query: string;
  onQueryChange: (value: string) => void;
  sortBy: DashboardSortBy;
  onSortByChange: (sortBy: DashboardSortBy) => void;
  descending: boolean;
  onToggleDirection: () => void;
  loading: boolean;
  totalLabel: string;
  hasMore: boolean;
  onLoadMore: () => void;
  onCreateNote: () => void;
  searchStatus: SearchStatus;
  searchResults: readonly SearchResult[];
  searchHasMore: boolean;
  onLoadMoreResults: () => void;
  indexState: IndexState;
  onOpenRecovery: () => void;
  searchRef: RefObject<HTMLInputElement | null>;
}

/* REQ-008 sort fields; labels match Design_System.md 9.2 toolbar copy. */
const SORT_CHOICES: ReadonlyArray<{ value: DashboardSortBy; label: string }> = [
  { value: "modified", label: "Modified" },
  { value: "created", label: "Created" },
  { value: "name", label: "Name" },
  { value: "size", label: "Size" },
];

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

function DegradedBanner({ onOpenRecovery }: { onOpenRecovery: () => void }) {
  return (
    <div
      role="status"
      className="flex items-center gap-2 border-b border-border-active bg-warning-bg px-3 py-2 text-xs text-text-secondary"
    >
      <span className="shrink-0 text-warning">
        <WarningIcon size={14} />
      </span>
      <span className="min-w-0 flex-1">Search index is degraded. Notes stay editable.</span>
      <Button size="sm" onClick={onOpenRecovery}>
        Rebuild
      </Button>
    </div>
  );
}

function SearchResultList(props: NotesPaneProps) {
  const { searchStatus, searchResults } = props;
  if (searchStatus === "searching" && searchResults.length === 0) {
    return <NoteListSkeleton />;
  }
  if (searchStatus === "ready" && searchResults.length === 0) {
    return <EmptyState query={props.query} onCreateNote={props.onCreateNote} />;
  }
  return (
    <>
      {searchResults.map((result) => (
        <SearchResultItem
          key={result.noteKey}
          result={result}
          selected={result.noteKey === props.selectedKey}
          onSelect={props.onSelect}
        />
      ))}
      {props.searchHasMore ? (
        <div className="p-2">
          <Button size="sm" className="w-full" onClick={props.onLoadMoreResults}>
            Load more results
          </Button>
        </div>
      ) : null}
    </>
  );
}

function NoteList(props: NotesPaneProps & { scrollRef: RefObject<HTMLDivElement | null> }) {
  return (
    <NotesVirtualList
      notes={props.notes}
      selectedKey={props.selectedKey}
      onSelect={props.onSelect}
      scrollRef={props.scrollRef}
    />
  );
}

export function NotesPane(props: NotesPaneProps) {
  const { notes, loading } = props;
  const searching = props.query.trim().length > 0;
  // Scroll parent for the virtualizer (REQ-031).
  const scrollRef = useRef<HTMLDivElement | null>(null);

  return (
    <section
      aria-label="Notes"
      className="flex h-full min-h-0 flex-col border-r border-border-subtle bg-surface-panel"
    >
      <DashboardToolbar
        query={props.query}
        onQueryChange={(event) => props.onQueryChange(event.target.value)}
        resultCount={props.totalLabel}
        sortOptions={SORT_CHOICES.map((choice) => choice.label)}
        sortValue={SORT_CHOICES.find((choice) => choice.value === props.sortBy)?.label ?? "Modified"}
        onSortChange={(label) => {
          const choice = SORT_CHOICES.find((candidate) => candidate.label === label);
          if (choice) props.onSortByChange(choice.value);
        }}
        descending={props.descending}
        onToggleDirection={props.onToggleDirection}
        searchRef={props.searchRef}
      />
      {props.indexState === "degraded" ? (
        <DegradedBanner onOpenRecovery={props.onOpenRecovery} />
      ) : null}
      <div
        ref={scrollRef}
        aria-busy={loading || undefined}
        className="min-h-0 flex-1 overflow-y-auto [scrollbar-color:var(--color-border-strong)_transparent] [scrollbar-width:thin]"
      >
        {loading ? <NoteListSkeleton /> : null}
        {!loading && searching ? <SearchResultList {...props} /> : null}
        {!loading && !searching ? (
          <>
            <NoteList {...props} scrollRef={scrollRef} />
            {notes.length === 0 ? (
              <EmptyState query="" onCreateNote={props.onCreateNote} />
            ) : null}
            {props.hasMore ? (
              <div className="p-2">
                <Button size="sm" className="w-full" onClick={props.onLoadMore}>
                  Load more
                </Button>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  );
}
