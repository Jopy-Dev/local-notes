import type { NoteListEntry } from "./NoteListItem";

/*
 * <NoteCard> per Design_System.md 9.2: card variant of the note entry -
 * heading + capped preview + metadata; one focus target per card (REQ-007).
 */
interface NoteCardProps {
  note: NoteListEntry;
  selected: boolean;
  onSelect: (key: string) => void;
}

export function NoteCard({ note, selected, onSelect }: NoteCardProps) {
  return (
    <button
      type="button"
      aria-current={selected || undefined}
      onClick={() => onSelect(note.key)}
      className={[
        "flex min-h-32 w-full cursor-pointer flex-col rounded-panel border p-3 text-left",
        selected
          ? "border-border-active bg-surface-selected shadow-selected"
          : "border-border-subtle bg-surface-panel hover:bg-surface-hover",
      ].join(" ")}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-ui font-heading text-text-primary">
          {note.title}
        </span>
        <span className="shrink-0 text-2xs text-text-muted tabular-nums">{note.time}</span>
      </span>
      <span className="mt-1.5 line-clamp-3 flex-1 text-xs leading-snug text-text-secondary">
        {note.preview}
      </span>
      <span className="mt-2 flex items-center gap-1.5 text-2xs text-text-muted">
        <span className="rounded-sm border border-border-subtle px-1 py-px font-mono text-2xs">
          {note.fileType}
        </span>
        <span className="truncate">{note.path}</span>
      </span>
    </button>
  );
}
