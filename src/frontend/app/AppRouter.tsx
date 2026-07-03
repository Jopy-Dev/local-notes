import { useEffect, useSyncExternalStore } from "react";
import { SearchRecoveryPage } from "../pages/SearchRecoveryPage";
import { WorkspaceShellPage } from "../pages/WorkspaceShellPage";
import { parseRoute } from "./routes";

/*
 * History-API router (MasterPrompt.md 1.6): exact routes, popstate restore,
 * unknown paths redirect to "/" without a server request. Dashboard and note
 * surfaces render the workspace shell; search recovery landed Wave 3; the
 * dedicated settings surface arrives Wave 7.
 */
function subscribe(onChange: () => void): () => void {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
}

export function AppRouter() {
  const pathname = useSyncExternalStore(
    subscribe,
    () => window.location.pathname,
    () => "/",
  );
  const route = parseRoute(pathname);

  useEffect(() => {
    if (!route) window.history.replaceState(null, "", "/");
  }, [route]);

  if (!route) return <WorkspaceShellPage />;

  switch (route.name) {
    case "dashboard":
    case "note":
    case "settings":
      return <WorkspaceShellPage />;
    case "search-recovery":
      return <SearchRecoveryPage />;
  }
}
