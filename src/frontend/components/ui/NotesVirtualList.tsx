import { useVirtualizer } from "@tanstack/react-virtual";
import type { RefObject } from "react";
import { NoteCard } from "./NoteCard";
import { NoteListItem } from "./NoteListItem";
import type { NoteListEntry } from "./NoteListItem";

/*
 * <NotesVirtualList> (REQ-031): incremental rendering for the dashboard note
 * collection - only visible rows (plus overscan) exist in the DOM, so 10,000
 * notes never materialize 10,000 nodes. Card view virtualizes chunk-rows of
 * two cards; remount on view switch (parent keys by view) resets measures.
 */
const LIST_ROW_ESTIMATE_PX = 92; // NoteListItem min-h-23
const CARD_ROW_ESTIMATE_PX = 136; // NoteCard min-h-32 + row padding
const OVERSCAN_ROWS = 8;

interface NotesVirtualListProps {
  notes: readonly NoteListEntry[];
  view: "list" | "card";
  selectedKey: string;
  onSelect: (key: string) => void;
  scrollRef: RefObject<HTMLDivElement | null>;
}

export function NotesVirtualList({ notes, view, selectedKey, onSelect, scrollRef }: NotesVirtualListProps) {
  const perRow = view === "card" ? 2 : 1;
  const rowCount = Math.ceil(notes.length / perRow);
  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => (view === "card" ? CARD_ROW_ESTIMATE_PX : LIST_ROW_ESTIMATE_PX),
    overscan: OVERSCAN_ROWS,
    // Pre-observation viewport guess; real measurements replace it on mount.
    // Also what jsdom component tests render with (no layout engine there).
    initialRect: { width: 400, height: 600 },
  });

  return (
    <div
      data-testid="notes-virtual-list"
      className="relative w-full"
      style={{ height: virtualizer.getTotalSize() }}
    >
      {virtualizer.getVirtualItems().map((row) => {
        const slice = notes.slice(row.index * perRow, row.index * perRow + perRow);
        return (
          <div
            key={row.key}
            ref={virtualizer.measureElement}
            data-index={row.index}
            className={
              view === "card" ? "absolute top-0 left-0 grid w-full grid-cols-2 gap-2 px-2 pt-2" : "absolute top-0 left-0 w-full"
            }
            style={{ transform: `translateY(${row.start}px)` }}
          >
            {slice.map((note) =>
              view === "card" ? (
                <NoteCard key={note.key} note={note} selected={note.key === selectedKey} onSelect={onSelect} />
              ) : (
                <NoteListItem key={note.key} note={note} selected={note.key === selectedKey} onSelect={onSelect} />
              ),
            )}
          </div>
        );
      })}
    </div>
  );
}
