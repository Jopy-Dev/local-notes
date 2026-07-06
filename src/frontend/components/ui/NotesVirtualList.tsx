import { useVirtualizer } from "@tanstack/react-virtual";
import type { RefObject } from "react";
import { NoteListItem } from "./NoteListItem";
import type { NoteListEntry } from "./NoteListItem";

/*
 * <NotesVirtualList> (REQ-031): incremental rendering for the dashboard note
 * collection - only visible rows (plus overscan) exist in the DOM, so 10,000
 * notes never materialize 10,000 nodes.
 */
const LIST_ROW_ESTIMATE_PX = 92; // NoteListItem min-h-23
const OVERSCAN_ROWS = 8;

interface NotesVirtualListProps {
  notes: readonly NoteListEntry[];
  selectedKey: string;
  onSelect: (key: string) => void;
  scrollRef: RefObject<HTMLDivElement | null>;
}

export function NotesVirtualList({ notes, selectedKey, onSelect, scrollRef }: NotesVirtualListProps) {
  const virtualizer = useVirtualizer({
    count: notes.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => LIST_ROW_ESTIMATE_PX,
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
        const note = notes[row.index];
        if (!note) return null;
        return (
          <div
            key={row.key}
            ref={virtualizer.measureElement}
            data-index={row.index}
            className="absolute top-0 left-0 w-full"
            style={{ transform: `translateY(${row.start}px)` }}
          >
            <NoteListItem note={note} selected={note.key === selectedKey} onSelect={onSelect} />
          </div>
        );
      })}
    </div>
  );
}
