/*
 * SPA navigation helper (MasterPrompt.md 1.6): pushState + synthetic popstate
 * so the History-API router re-renders without a full page load.
 */
export function navigate(path: string): void {
  window.history.pushState(null, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

/*
 * /settings is a route (SCREEN-003) opened over whatever surface the user was
 * on; closing returns there. Module-held like services/token - survives the
 * dialog lifecycle, resets on direct /settings loads (fallback "/").
 */
let settingsReturnPath: string | null = null;

export function openSettingsRoute(): void {
  if (window.location.pathname !== "/settings") {
    settingsReturnPath = window.location.pathname;
  }
  navigate("/settings");
}

export function closeSettingsRoute(): void {
  // Idempotent: Apply navigates, then the Modal close event fires this
  // again - a second call must not consume a fresh navigation to "/".
  if (window.location.pathname !== "/settings") return;
  const target = settingsReturnPath ?? "/";
  settingsReturnPath = null;
  navigate(target);
}

/*
 * The note the settings dialog opened over (SCREEN-003): the shell keeps it
 * mounted under the dialog so the open editor is never unmounted (a phantom
 * close would flush drafts and reset the visual verdict).
 */
export function settingsReturnNoteKey(): string | null {
  if (window.location.pathname !== "/settings") return null;
  const match = /^\/notes\/([A-Za-z0-9_-]+)$/.exec(settingsReturnPath ?? "");
  return match?.[1] ?? null;
}
