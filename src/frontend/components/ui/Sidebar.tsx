import type { ReactNode } from "react";

/*
 * <Sidebar> per Design_System.md 9.1: complementary landmark + labelled
 * navigation region. Launch surface renders the empty workspace state.
 */
interface SidebarProps {
  label: string;
  eyebrow: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function Sidebar({ label, eyebrow, children, footer }: SidebarProps) {
  return (
    <aside
      aria-label={label}
      className="flex min-h-0 flex-col border-r border-border-subtle bg-surface-sidebar [grid-area:sidebar]"
    >
      <div className="flex min-h-9.5 items-center border-b border-border-subtle py-0 pr-2.5 pl-3.5">
        <span className="text-xs font-heading tracking-eyebrow text-text-muted uppercase">
          {eyebrow}
        </span>
      </div>
      {children}
      {footer ? <div className="border-t border-border-subtle p-2.5">{footer}</div> : null}
    </aside>
  );
}
