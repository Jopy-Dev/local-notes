import { apiGet, apiPut } from "./api";
import type { ConfigUpdate, ConfigV1 } from "../../shared/schemas/config.js";

/*
 * Settings API (MasterPrompt.md 5.2, WF-010): GET returns ConfigV1; PUT sends
 * only the changed fields - the server merges, validates, persists atomically,
 * and broadcasts settings.changed.
 */
export function fetchSettings(): Promise<ConfigV1> {
  return apiGet<ConfigV1>("/settings");
}

export function updateSettings(partial: ConfigUpdate): Promise<ConfigV1> {
  return apiPut<ConfigV1>("/settings", partial);
}
