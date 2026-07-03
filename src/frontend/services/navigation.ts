/*
 * SPA navigation helper (MasterPrompt.md 1.6): pushState + synthetic popstate
 * so the History-API router re-renders without a full page load.
 */
export function navigate(path: string): void {
  window.history.pushState(null, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
