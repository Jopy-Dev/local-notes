/*
 * Exact client routes (MasterPrompt.md 1.6). noteKey is opaque base64url;
 * anything else is not a route - caller redirects to "/" without a server
 * request.
 */
export type Route =
  | { name: "dashboard" }
  | { name: "note"; noteKey: string }
  | { name: "settings" }
  | { name: "search-recovery" };

const NOTE_KEY_PATTERN = /^[A-Za-z0-9_-]+$/;

export function parseRoute(pathname: string): Route | null {
  if (pathname === "/") return { name: "dashboard" };
  if (pathname === "/settings") return { name: "settings" };
  if (pathname === "/recovery/search") return { name: "search-recovery" };
  const noteMatch = /^\/notes\/([^/]+)$/.exec(pathname);
  if (noteMatch?.[1] && NOTE_KEY_PATTERN.test(noteMatch[1])) {
    return { name: "note", noteKey: noteMatch[1] };
  }
  return null;
}
