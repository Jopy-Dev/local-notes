import type { ChangeEventHandler, RefObject } from "react";
import { CardViewIcon, ListViewIcon, SearchIcon, SortIcon } from "../icons";
import { IconButton } from "./IconButton";
import { Kbd } from "./Kbd";
import { Select } from "./Select";

/*
 * <DashboardToolbar> per Design_System.md 9.2: labelled search, sort with
 * pressed direction state (WF-002/004). Result count in tabular numerals.
 */
interface DashboardToolbarProps {
  query: string;
  onQueryChange: ChangeEventHandler<HTMLInputElement>;
  resultCount: string;
  sortOptions: readonly string[];
  sortValue: string;
  onSortChange: (label: string) => void;
  descending: boolean;
  onToggleDirection: () => void;
  view?: "list" | "card";
  onViewChange?: (view: "list" | "card") => void;
  searchRef?: RefObject<HTMLInputElement | null>;
}

export function DashboardToolbar({
  query,
  onQueryChange,
  resultCount,
  sortOptions,
  sortValue,
  onSortChange,
  descending,
  onToggleDirection,
  view,
  onViewChange,
  searchRef,
}: DashboardToolbarProps) {
  return (
    <div className="border-b border-border-subtle px-2.5 pt-2 pb-2">
      <div className="relative">
        <label htmlFor="note-search" className="sr-only">
          Search notes
        </label>
        <span className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-text-muted">
          <SearchIcon size={15} />
        </span>
        <input
          ref={searchRef}
          id="note-search"
          type="search"
          placeholder="Search notes"
          autoComplete="off"
          value={query}
          onChange={onQueryChange}
          className="h-8 w-full rounded-control border border-border-subtle bg-surface-input px-7.5 text-body text-text-primary placeholder:text-text-muted"
        />
        <span className="absolute top-1/2 right-1.5 -translate-y-1/2">
          <Kbd>Ctrl P</Kbd>
        </span>
      </div>
      <div className="mt-2 flex items-center gap-1">
        <span className="mr-auto text-xs text-text-muted tabular-nums">{resultCount}</span>
        <label htmlFor="sort-select" className="sr-only">
          Sort notes
        </label>
        <Select
          id="sort-select"
          compact
          options={sortOptions}
          value={sortValue}
          onChange={(event) => onSortChange(event.target.value)}
        />
        <IconButton
          label={descending ? "Sort descending" : "Sort ascending"}
          pressed={descending}
          onClick={onToggleDirection}
        >
          <SortIcon size={16} />
        </IconButton>
        {view && onViewChange ? (
          <>
            <IconButton label="List view" pressed={view === "list"} onClick={() => onViewChange("list")}>
              <ListViewIcon size={16} />
            </IconButton>
            <IconButton label="Card view" pressed={view === "card"} onClick={() => onViewChange("card")}>
              <CardViewIcon size={16} />
            </IconButton>
          </>
        ) : null}
      </div>
    </div>
  );
}
