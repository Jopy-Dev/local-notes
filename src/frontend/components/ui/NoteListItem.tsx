import { WarningIcon } from "../icons";

/*
 * <NoteListItem> per Design_System.md 9.2: one accessible name, selected =
 * surface-selected + shadow-selected accent edge, metadata-only warning is
 * explicit text (never color-only). Preview capped upstream at 240 chars.
 */
export interface NoteListEntry {
  key: string;
  title: string;
  time: string;
  preview: string;
  fileType: "MD" | "TXT";
  path: string;
  metadataOnly?: boolean;
}

interface NoteListItemProps {
  note: NoteListEntry;
  selected: boolean;
  onSelect: (key: string) => void;
}

export function NoteListItem({ note, selected, onSelect }: NoteListItemProps) {
  return (
    <button
      type="button"
      aria-current={selected || undefined}
      onClick={() => onSelect(note.key)}
      className={[
        "block min-h-23 w-full cursor-pointer border-0 border-b border-border-subtle bg-transparent px-3 pt-3 pb-2.5 text-left text-inherit",
        selected ? "bg-surface-selected shadow-selected" : "hover:bg-surface-hover",
      ].join(" ")}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-ui font-heading text-text-primary">
          {note.title}
        </span>
        <span className="shrink-0 text-2xs text-text-muted tabular-nums">{note.time}</span>
      </span>
      <span className="mt-1.5 line-clamp-2 text-xs leading-snug text-text-secondary">
        {note.preview}
      </span>
      <span className="mt-2 flex items-center gap-1.5 text-2xs text-text-muted">
        <span className="rounded-sm border border-border-subtle px-1 py-px font-mono text-2xs">
          {note.fileType}
        </span>
        <span>{note.path}</span>
        {note.metadataOnly === true ? (
          <span className="inline-flex items-center gap-1 text-warning">
            <WarningIcon size={14} className="h-2.5 w-2.5" />
            Metadata only
          </span>
        ) : null}
      </span>
    </button>
  );
}
