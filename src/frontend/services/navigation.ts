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
  const target = settingsReturnPath ?? "/";
  settingsReturnPath = null;
  navigate(target);
}
