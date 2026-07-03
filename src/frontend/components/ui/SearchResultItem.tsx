import { WarningIcon } from "../icons";
import { formatNoteTime } from "../../services/noteView";
import type { SearchResult } from "../../../shared/schemas/search.js";

/*
 * <SearchResult> per Design_System.md 9.2: highlighted match via <mark>,
 * snippet max 180 chars, metadata-only and truncated warnings as explicit
 * text (never color-only). One accessible name per result.
 */
function markSnippet(snippet: string, ranges: ReadonlyArray<readonly [number, number]>) {
  if (ranges.length === 0) return snippet;
  const parts: Array<string | { marked: string }> = [];
  let cursor = 0;
  for (const [start, end] of ranges) {
    if (start > cursor) parts.push(snippet.slice(cursor, start));
    parts.push({ marked: snippet.slice(start, end) });
    cursor = end;
  }
  if (cursor < snippet.length) parts.push(snippet.slice(cursor));
  return parts.map((part, index) =>
    typeof part === "string" ? (
      part
    ) : (
      <mark key={index} className="rounded-xs bg-accent-muted px-px text-text-primary">
        {part.marked}
      </mark>
    ),
  );
}

interface SearchResultItemProps {
  result: SearchResult;
  selected: boolean;
  onSelect: (key: string) => void;
}

export function SearchResultItem({ result, selected, onSelect }: SearchResultItemProps) {
  return (
    <button
      type="button"
      aria-current={selected || undefined}
      onClick={() => onSelect(result.noteKey)}
      className={[
        "block w-full cursor-pointer border-b border-border-subtle px-3 pt-3 pb-2.5 text-left",
        selected ? "bg-surface-selected shadow-selected" : "hover:bg-surface-hover",
      ].join(" ")}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-ui font-heading text-text-primary">
          {result.title}
        </span>
        <span className="shrink-0 text-2xs text-text-muted tabular-nums">
          {formatNoteTime(result.modifiedAt)}
        </span>
      </span>
      {result.snippet ? (
        <span className="mt-1 line-clamp-2 block text-xs leading-snug text-text-secondary">
          {markSnippet(result.snippet, result.matchRanges)}
        </span>
      ) : null}
      <span className="mt-1.5 flex min-w-0 items-center gap-1.5 text-2xs text-text-muted">
        <span className="rounded-sm border border-border-subtle px-1 py-px font-mono text-2xs">
          {result.extension === ".md" ? "MD" : "TXT"}
        </span>
        <span className="truncate">{result.folder}</span>
        {result.contentIndexStatus === "metadata-only" ? (
          <span className="flex shrink-0 items-center gap-1 text-warning">
            <WarningIcon size={14} />
            Content not indexed: memory budget
          </span>
        ) : null}
        {result.truncated ? (
          <span className="flex shrink-0 items-center gap-1 text-warning">
            <WarningIcon size={14} />
            Match limited to first 5 MiB
          </span>
        ) : null}
      </span>
    </button>
  );
}
