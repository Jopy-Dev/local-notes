import { useSettingsData } from "./settingsData";
import type { ConfigUpdate, ConfigV1 } from "../../shared/schemas/config.js";

/*
 * Dashboard preference plumbing (WF-004, REQ-007/008): optimistic commit
 * with rollback + corrective refetch, and the effective-sort resolution used
 * by note-page fetches (session override wins, else persisted config).
 */
export function persistPreference(options: {
  update: ConfigUpdate;
  apply: () => void;
  rollback: () => void;
  refetch?: () => void;
}): void {
  options.apply();
  options.refetch?.();
  void useSettingsData
    .getState()
    .apply(options.update)
    .then((persisted) => {
      if (!persisted) {
        options.rollback();
        options.refetch?.();
      }
    });
}

export function effectiveSort(state: {
  sortBy: ConfigV1["sortBy"] | null;
  sortDirection: ConfigV1["sortDirection"] | null;
}): { sort: ConfigV1["sortBy"]; direction: ConfigV1["sortDirection"] } {
  const config = useSettingsData.getState().config;
  return {
    sort: state.sortBy ?? config?.sortBy ?? "modified",
    direction: state.sortDirection ?? config?.sortDirection ?? "desc",
  };
}
