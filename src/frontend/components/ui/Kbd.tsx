import type { ReactNode } from "react";

// Shortcut hint chip - redundant metadata only (Design_System.md 3.3, text-2xs tier).
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-sm border border-border-subtle bg-surface-raised px-1 py-0.5 font-mono text-2xs leading-tight text-text-muted">
      {children}
    </kbd>
  );
}
