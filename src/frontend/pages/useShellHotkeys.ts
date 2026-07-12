import { useEffect } from "react";

/*
 * App-shell keyboard contract (Design_System.md 11): Ctrl+K palette,
 * Ctrl+P search, Ctrl+N create, Ctrl+, settings, Ctrl+\ split toggle,
 * Ctrl+Shift+F focus mode, Ctrl+F find in note (REQ-035), Escape exits
 * the innermost transient layer when no modal open.
 */
interface ShellHotkeyHandlers {
  openCommand: () => void;
  focusSearch: () => void;
  openNewNote: () => void;
  openSettings: () => void;
  toggleSplit: () => void;
  toggleFocusMode: () => void;
  openFind: (selection?: string) => void;
  onEscape: () => void;
}

interface Binding {
  key: string;
  shift?: boolean;
  run: (handlers: ShellHotkeyHandlers) => void;
}

const modifierBindings: readonly Binding[] = [
  { key: "f", shift: true, run: (handlers) => handlers.toggleFocusMode() },
  // Round 9: a selection at Ctrl+F time seeds the find query. Outside the
  // source editor the DOM selection is the only selection source.
  { key: "f", run: (handlers) => handlers.openFind(window.getSelection()?.toString()) },
  { key: "k", run: (handlers) => handlers.openCommand() },
  { key: "p", run: (handlers) => handlers.focusSearch() },
  { key: "n", run: (handlers) => handlers.openNewNote() },
  { key: ",", run: (handlers) => handlers.openSettings() },
  { key: "\\", run: (handlers) => handlers.toggleSplit() },
];

export function useShellHotkeys(handlers: ShellHotkeyHandlers) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // The source editor handles Mod-f itself (with its own selection);
      // a prevented event must not open find a second time (round 9).
      if (event.defaultPrevented) return;
      if (event.key === "Escape") {
        handlers.onEscape();
        return;
      }
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      const binding = modifierBindings.find(
        (candidate) => candidate.key === key && (candidate.shift ?? false) === event.shiftKey,
      );
      if (binding) {
        event.preventDefault();
        binding.run(handlers);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [handlers]);
}
