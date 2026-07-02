import type { ReactNode } from "react";

/*
 * <FolderTree> per Design_System.md 9.2: labelled navigation, current item
 * explicit via aria-current, counts in tabular numerals. Existing folders only.
 */
export interface TreeEntry {
  key: string;
  label: string;
  count: number;
  icon: ReactNode;
  indent?: boolean;
}

interface TreeSectionProps {
  title?: string;
  entries: readonly TreeEntry[];
  activeKey: string;
  onSelect: (key: string) => void;
}

export function TreeSection({ title, entries, activeKey, onSelect }: TreeSectionProps) {
  return (
    <div className="[&+&]:mt-4">
      {title ? (
        <div className="flex items-center px-1.5 pb-1 text-2xs font-heading tracking-eyebrow text-text-muted uppercase">
          {title}
        </div>
      ) : null}
      {entries.map((entry) => {
        const active = entry.key === activeKey;
        return (
          <button
            key={entry.key}
            type="button"
            aria-current={active ? "page" : undefined}
            onClick={() => onSelect(entry.key)}
            className={[
              "flex min-h-8 w-full cursor-pointer items-center gap-1.5 rounded-control border px-1.5 text-left text-ui",
              entry.indent === true ? "pl-6" : "",
              active
                ? "border-border-active bg-surface-selected text-text-primary [&_svg]:text-accent"
                : "border-transparent bg-transparent text-text-secondary hover:bg-surface-hover hover:text-text-primary [&_svg]:text-text-muted",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <span className="shrink-0">{entry.icon}</span>
            <span className="min-w-0 flex-1 truncate">{entry.label}</span>
            <span className="text-2xs text-text-muted tabular-nums">{entry.count}</span>
          </button>
        );
      })}
    </div>
  );
}

export function FolderTree({ label, children }: { label: string; children: ReactNode }) {
  return (
    <nav
      aria-label={label}
      className="min-h-0 flex-1 overflow-y-auto p-1.5 [scrollbar-color:var(--color-border-strong)_transparent] [scrollbar-width:thin]"
    >
      {children}
    </nav>
  );
}
