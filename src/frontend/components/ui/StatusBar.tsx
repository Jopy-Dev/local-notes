import type { ReactNode } from "react";

/*
 * <StatusBar> per Design_System.md 9.2: contentinfo landmark, always visible
 * (including Focus Mode). Height = layout-statusbar 24px (4.1).
 */
interface StatusBarProps {
  children: ReactNode;
}

export function StatusBar({ children }: StatusBarProps) {
  return (
    <footer
      aria-label="Application status"
      className="flex h-6 min-w-0 select-none items-center gap-3.5 border-t border-border-subtle bg-surface-titlebar px-2 text-xs text-text-muted [grid-area:status]"
    >
      {children}
    </footer>
  );
}

interface StatusItemProps {
  dot?: "success" | "warning" | "danger";
  mono?: boolean;
  children: ReactNode;
}

export function StatusItem({ dot, mono = false, children }: StatusItemProps) {
  return (
    <span
      className={[
        "inline-flex min-w-0 items-center gap-1.5 whitespace-nowrap",
        mono ? "overflow-hidden font-mono text-ellipsis" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {dot ? (
        <span
          aria-hidden="true"
          className={[
            "h-1.5 w-1.5 rounded-pill",
            dot === "success" ? "bg-success shadow-status" : "",
            dot === "warning" ? "bg-warning" : "",
            dot === "danger" ? "bg-danger" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        />
      ) : null}
      {children}
    </span>
  );
}

export function StatusSpacer() {
  return <span className="flex-1" />;
}
