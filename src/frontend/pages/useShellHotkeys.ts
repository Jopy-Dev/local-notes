import { useEffect } from "react";

/*
 * App-shell keyboard contract (Design_System.md 11): Ctrl+K palette,
 * Ctrl+P search, Ctrl+N create, Ctrl+, settings, Ctrl+\ split toggle,
 * Ctrl+Shift+F focus mode, Escape exits focus mode when no modal open.
 */
interface ShellHotkeyHandlers {
  openCommand: () => void;
  focusSearch: () => void;
  openNewNote: () => void;
  openSettings: () => void;
  toggleSplit: () => void;
  toggleFocusMode: () => void;
  onEscape: () => void;
}

interface Binding {
  key: string;
  shift?: boolean;
  run: (handlers: ShellHotkeyHandlers) => void;
}

const modifierBindings: readonly Binding[] = [
  { key: "f", shift: true, run: (handlers) => handlers.toggleFocusMode() },
  { key: "k", run: (handlers) => handlers.openCommand() },
  { key: "p", run: (handlers) => handlers.focusSearch() },
  { key: "n", run: (handlers) => handlers.openNewNote() },
  { key: ",", run: (handlers) => handlers.openSettings() },
  { key: "\\", run: (handlers) => handlers.toggleSplit() },
];

export function useShellHotkeys(handlers: ShellHotkeyHandlers) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
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
