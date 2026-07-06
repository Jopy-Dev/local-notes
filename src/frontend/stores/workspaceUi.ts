import { create } from "zustand";
import { useSettingsData } from "./settingsData";
import type { ConfigUpdate, ConfigV1 } from "../../shared/schemas/config.js";

/*
 * Workspace pane layout state (REQ-034, WF-012, MasterPrompt 4.10). Widths
 * and collapsed flags hydrate from ConfigV1 and persist through the settings
 * API: width commits debounce 250ms and send only the changed field;
 * collapse/expand commits immediately. Persistence failure rolls the pane
 * back to its last-persisted value (WF-010 optimistic-rollback rule).
 * Collapsed panes remember their pre-collapse width in session state only -
 * the boolean persists, the prior width does not.
 */
export const PANE_BOUNDS = {
  folder: { min: 190, max: 280, default: 220 },
  notes: { min: 280, max: 420, default: 320 },
} as const;

export type PaneKind = keyof typeof PANE_BOUNDS;

const COMMIT_DEBOUNCE_MS = 250;

const WIDTH_FIELD: Record<PaneKind, "folderPaneWidth" | "notesPaneWidth"> = {
  folder: "folderPaneWidth",
  notes: "notesPaneWidth",
};
const COLLAPSED_FIELD: Record<PaneKind, "folderPaneCollapsed" | "notesPaneCollapsed"> = {
  folder: "folderPaneCollapsed",
  notes: "notesPaneCollapsed",
};

interface WorkspaceUiState {
  widths: Record<PaneKind, number>;
  collapsed: Record<PaneKind, boolean>;
  /* Last width the settings API accepted - rollback target. */
  persistedWidths: Record<PaneKind, number>;
  /* Pre-collapse width, session-only (MasterPrompt 4.10). */
  priorWidths: Record<PaneKind, number>;
  /* Source-mode soft wrap (user feedback round 3): view preference,
   * session-only - never persisted, never touches the document. */
  lineWrap: boolean;
  hydrate: (config: ConfigV1) => void;
  /* Live drag/keyboard update - no persistence. */
  resizePane: (pane: PaneKind, width: number) => void;
  /* Debounced width persistence with rollback. */
  commitPane: (pane: PaneKind, width: number) => void;
  toggleCollapsed: (pane: PaneKind) => void;
  toggleLineWrap: () => void;
}

const timers: Partial<Record<PaneKind, ReturnType<typeof setTimeout>>> = {};

export const useWorkspaceUi = create<WorkspaceUiState>((set, get) => ({
  widths: { folder: PANE_BOUNDS.folder.default, notes: PANE_BOUNDS.notes.default },
  collapsed: { folder: false, notes: false },
  persistedWidths: { folder: PANE_BOUNDS.folder.default, notes: PANE_BOUNDS.notes.default },
  priorWidths: { folder: PANE_BOUNDS.folder.default, notes: PANE_BOUNDS.notes.default },
  lineWrap: true,

  hydrate: (config) => {
    const widths = { folder: config.folderPaneWidth, notes: config.notesPaneWidth };
    set({
      widths,
      persistedWidths: { ...widths },
      priorWidths: { ...widths },
      collapsed: { folder: config.folderPaneCollapsed, notes: config.notesPaneCollapsed },
    });
  },

  resizePane: (pane, width) => {
    set({ widths: { ...get().widths, [pane]: width } });
  },

  commitPane: (pane, width) => {
    set({ widths: { ...get().widths, [pane]: width } });
    const pending = timers[pane];
    if (pending) clearTimeout(pending);
    timers[pane] = setTimeout(() => {
      delete timers[pane];
      const partial: ConfigUpdate = { [WIDTH_FIELD[pane]]: width };
      void useSettingsData
        .getState()
        .apply(partial)
        .then((persisted) => {
          if (persisted) {
            set({ persistedWidths: { ...get().persistedWidths, [pane]: width } });
          } else {
            // Roll back to the last width the settings file accepted.
            set({ widths: { ...get().widths, [pane]: get().persistedWidths[pane] } });
          }
        });
    }, COMMIT_DEBOUNCE_MS);
  },

  toggleLineWrap: () => {
    set({ lineWrap: !get().lineWrap });
  },

  toggleCollapsed: (pane) => {
    const state = get();
    const next = !state.collapsed[pane];
    const priorWidths = next
      ? { ...state.priorWidths, [pane]: state.widths[pane] }
      : state.priorWidths;
    // Restore uses the session-held prior width without a settings round-trip.
    const widths = next ? state.widths : { ...state.widths, [pane]: state.priorWidths[pane] };
    set({ collapsed: { ...state.collapsed, [pane]: next }, priorWidths, widths });
    const partial: ConfigUpdate = { [COLLAPSED_FIELD[pane]]: next };
    void useSettingsData
      .getState()
      .apply(partial)
      .then((persisted) => {
        if (!persisted) {
          set({ collapsed: { ...get().collapsed, [pane]: !next } });
        }
      });
  },
}));

// Another tab's settings.changed lands as a settingsData reload; mirror the
// pane fields here so both tabs agree (own commits re-hydrate with identical
// values, which is a no-op for layout).
useSettingsData.subscribe((state, previous) => {
  if (state.config && state.config !== previous.config) {
    useWorkspaceUi.getState().hydrate(state.config);
  }
});
