import { useEffect, useRef, useState } from "react";
import { ChevronRightIcon, CloseIcon, SearchIcon } from "../icons";
import type { FindRequest } from "../../editor/find-in-note";
import { IconButton } from "./IconButton";
import { Input } from "./Input";

/*
 * <FindInNoteBar> per Design_System.md 9.2 (REQ-035, WF-013): shared find
 * shell over CodeMirror decorations (source) and CSS custom highlights
 * (preview). Query input debounces 150ms; match position announces through
 * a status live region; Escape closes via the shell hotkey contract and
 * returns focus to the caller.
 */
const QUERY_DEBOUNCE_MS = 150;

export interface FindController {
  open: boolean;
  query: string;
  caseSensitive: boolean;
  activeIndex: number;
  total: number;
  // Stable per query/index/case change - editor effects key off identity.
  request: FindRequest | null;
  onQueryChange: (query: string) => void;
  onToggleCase: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onClose: () => void;
  onMatches: (total: number) => void;
}

type FindBarProps = Omit<FindController, "open" | "request" | "onMatches">;

export function FindInNoteBar(props: FindBarProps) {
  const [input, setInput] = useState(props.query);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const onQueryChangeRef = useRef(props.onQueryChange);
  onQueryChangeRef.current = props.onQueryChange;

  useEffect(() => () => clearTimeout(timer.current), []);

  function changeInput(value: string) {
    setInput(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onQueryChangeRef.current(value), QUERY_DEBOUNCE_MS);
  }

  const hasQuery = props.query.trim() !== "";
  const status = !hasQuery
    ? ""
    : props.total === 0
      ? "No matches"
      : `${Math.min(props.activeIndex + 1, props.total)} of ${props.total}`;

  return (
    <div
      role="search"
      aria-label="Find in note"
      className="flex items-center gap-1.5 border-b border-border-subtle bg-surface-panel px-3 py-1.5"
    >
      <span aria-hidden className="text-text-muted">
        <SearchIcon size={14} />
      </span>
      <Input
        aria-label="Find in note"
        value={input}
        onChange={(event) => changeInput(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          if (event.shiftKey) props.onPrevious();
          else props.onNext();
        }}
        placeholder="Find in note"
        className="h-7 w-56 text-xs"
        autoFocus
      />
      <span
        role="status"
        className={`min-w-16 text-xs ${props.total === 0 && hasQuery ? "text-warning" : "text-text-muted"}`}
      >
        {status}
      </span>
      <button
        type="button"
        aria-label="Match case"
        aria-pressed={props.caseSensitive}
        title="Match case"
        onClick={props.onToggleCase}
        className={[
          "h-7 min-w-7 cursor-pointer rounded-control border-0 bg-transparent px-1 text-xs font-semibold",
          props.caseSensitive
            ? "bg-surface-raised text-text-primary"
            : "text-text-muted hover:text-text-secondary",
        ].join(" ")}
      >
        Aa
      </button>
      <IconButton
        label="Previous match"
        disabled={props.total === 0}
        onClick={props.onPrevious}
        className="-rotate-90"
      >
        <ChevronRightIcon size={14} />
      </IconButton>
      <IconButton
        label="Next match"
        disabled={props.total === 0}
        onClick={props.onNext}
        className="rotate-90"
      >
        <ChevronRightIcon size={14} />
      </IconButton>
      <IconButton label="Close find" onClick={props.onClose}>
        <CloseIcon size={14} />
      </IconButton>
    </div>
  );
}
