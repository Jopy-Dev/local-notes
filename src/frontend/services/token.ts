/*
 * Capability handling (ADR-003, MasterPrompt.md 4.1): read #access= fragment
 * once, store in sessionStorage ONLY (never localStorage/cookie/query/log),
 * strip fragment via history.replaceState before any API request.
 */
const STORAGE_KEY = "local-notes.capability";

export function adoptCapabilityFromFragment(): void {
  const match = /^#access=([A-Za-z0-9_-]+)$/.exec(window.location.hash);
  if (!match?.[1]) return;
  window.sessionStorage.setItem(STORAGE_KEY, match[1]);
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
}

export function getCapability(): string | null {
  return window.sessionStorage.getItem(STORAGE_KEY);
}
