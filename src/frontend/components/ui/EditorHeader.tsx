import type { ChangeEventHandler, ReactNode } from "react";
import { Fragment } from "react";
import { ChevronRightIcon } from "../icons";

/*
 * <EditorHeader> per Design_System.md 9.2: breadcrumb path, labelled title
 * input, action cluster (save state, mode tabs, focus, more). Preserved in
 * Focus Mode.
 */
interface EditorHeaderProps {
  breadcrumbs: readonly string[];
  title: string;
  onTitleChange: ChangeEventHandler<HTMLInputElement>;
  actions: ReactNode;
}

export function EditorHeader({ breadcrumbs, title, onTitleChange, actions }: EditorHeaderProps) {
  return (
    <header className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 border-b border-border-subtle bg-surface-titlebar py-2 pr-2.5 pl-4.5 [grid-template-areas:'crumbs_actions'_'title_actions']">
      <div
        aria-label="Current note path"
        className="flex min-w-0 items-center gap-1 overflow-hidden text-2xs whitespace-nowrap text-text-muted [grid-area:crumbs]"
      >
        {breadcrumbs.map((crumb, index) => (
          <Fragment key={crumb}>
            {index > 0 ? (
              <span className="shrink-0">
                <ChevronRightIcon size={14} className="h-2.5 w-2.5" />
              </span>
            ) : null}
            <span className="overflow-hidden text-ellipsis">{crumb}</span>
          </Fragment>
        ))}
      </div>
      <label htmlFor="note-title" className="sr-only">
        Note title
      </label>
      <input
        id="note-title"
        value={title}
        onChange={onTitleChange}
        className="h-8.5 min-w-0 border-0 bg-transparent p-0 text-title font-heading tracking-title text-text-primary [grid-area:title] focus-visible:rounded-xs focus-visible:outline-offset-3"
      />
      <div className="flex items-center gap-1 [grid-area:actions]">{actions}</div>
    </header>
  );
}
