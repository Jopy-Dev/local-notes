import { useEffect, useSyncExternalStore } from "react";
import { SearchRecoveryPage } from "../pages/SearchRecoveryPage";
import { WorkspaceShellPage } from "../pages/WorkspaceShellPage";
import { settingsReturnNoteKey } from "../services/navigation";
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
    case "note":
      return <WorkspaceShellPage noteKey={route.noteKey} />;
    case "dashboard":
      return <WorkspaceShellPage />;
    case "settings":
      // SCREEN-003: the settings form opens as a route-driven dialog over the
      // shell. The note it opened over stays mounted - unmounting would close
      // the editor (draft flush) for a dialog visit.
      return <WorkspaceShellPage settingsOpen noteKey={settingsReturnNoteKey()} />;
    case "search-recovery":
      return <SearchRecoveryPage />;
  }
}
