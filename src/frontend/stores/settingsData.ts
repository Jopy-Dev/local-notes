import { create } from "zustand";
import { ApiRequestError } from "../services/api";
import { fetchSettings, updateSettings } from "../services/settingsApi";
import { applyEditorAppearance, applyTheme } from "../services/theme";
import type { ConfigUpdate, ConfigV1 } from "../../shared/schemas/config.js";

/*
 * Settings store (SCREEN-003, WF-010, REQ-021/022/034). Holds the persisted
 * ConfigV1 plus a transient theme preview (optimistic theme only - persisted
 * values roll back on failure per MasterPrompt 6.2). Every successful config
 * change re-applies theme + editor appearance so changes land without
 * restart. settings.changed SSE routes into reload() for other tabs.
 */
interface SettingsDataState {
  config: ConfigV1 | null;
  saving: boolean;
  fieldErrors: Record<string, string[]> | null;
  previewTheme: ConfigV1["theme"] | null;
  hydrate: (config: ConfigV1) => void;
  reload: () => Promise<void>;
  apply: (partial: ConfigUpdate) => Promise<boolean>;
  setPreviewTheme: (theme: ConfigV1["theme"] | null) => void;
  clearErrors: () => void;
}

function applyAppearance(config: ConfigV1): void {
  applyTheme(config.theme);
  applyEditorAppearance(config);
}

export const useSettingsData = create<SettingsDataState>((set, get) => ({
  config: null,
  saving: false,
  fieldErrors: null,
  previewTheme: null,

  hydrate: (config) => {
    set({ config, previewTheme: null });
    applyAppearance(config);
  },

  reload: async () => {
    try {
      get().hydrate(await fetchSettings());
    } catch {
      // Stale local copy remains usable; next successful write refreshes it.
    }
  },

  apply: async (partial) => {
    set({ saving: true, fieldErrors: null });
    try {
      const config = await updateSettings(partial);
      set({ config, saving: false, previewTheme: null });
      applyAppearance(config);
      return true;
    } catch (error) {
      set({ saving: false });
      // Persisted values roll back: re-apply the last known good config.
      const current = get().config;
      if (current) applyAppearance(current);
      set({ previewTheme: null });
      if (error instanceof ApiRequestError && error.code === "INVALID_SETTING") {
        set({ fieldErrors: error.fieldErrors ?? { settings: [error.message] } });
      } else {
        set({ fieldErrors: { settings: ["Settings could not be saved. Check the local server and retry."] } });
      }
      return false;
    }
  },

  // Optimistic theme preview (WF-010): visual only until Apply persists it.
  setPreviewTheme: (theme) => {
    set({ previewTheme: theme });
    const config = get().config;
    applyTheme(theme ?? config?.theme ?? "system");
  },

  clearErrors: () => set({ fieldErrors: null }),
}));
