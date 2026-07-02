import { useEffect, useSyncExternalStore } from "react";
import { WorkspaceShellPage } from "../pages/WorkspaceShellPage";
import { parseRoute } from "./routes";

/*
 * History-API router (MasterPrompt.md 1.6): exact routes, popstate restore,
 * unknown paths redirect to "/" without a server request. Wave 0: dashboard,
 * note, and settings surfaces all render the workspace shell (mock data);
 * dedicated settings/recovery surfaces arrive Waves 3 and 7. The launch
 * first-run surface wires to real workspace state at Wave 2.
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
    case "search-recovery":
      return <WorkspaceShellPage />;
  }
}
