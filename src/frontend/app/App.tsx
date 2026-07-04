import { useEffect, useState } from "react";
import { SecureRelaunch } from "../components/SecureRelaunch";
import { LaunchPage } from "../pages/LaunchPage";
import { ApiRequestError, apiGet } from "../services/api";
import { applyTheme, watchSystemTheme } from "../services/theme";
import { getCapability } from "../services/token";
import { setWorkspaceDisplayPath } from "../services/workspace";
import { useSearchData } from "../stores/searchData";
import { useSettingsData } from "../stores/settingsData";
import { useWorkspaceData } from "../stores/workspaceData";
// Side-effect import: workspaceUi subscribes to settings hydration (REQ-034).
import "../stores/workspaceUi";
import type { BootstrapResponse } from "../../shared/schemas/bootstrap";
import { AppRouter } from "./AppRouter";

type BootState =
  | { phase: "loading" }
  | { phase: "ready"; bootstrap: BootstrapResponse }
  | { phase: "denied" }
  | { phase: "error"; message: string };

export function App() {
  const hasToken = getCapability() !== null;
  const [state, setState] = useState<BootState>({ phase: "loading" });

  useEffect(() => {
    if (!hasToken) return;
    let cancelled = false;
    apiGet<BootstrapResponse>("/bootstrap")
      .then((bootstrap) => {
        if (cancelled) return;
        // Seed index state; SSE index.status keeps it live afterwards.
        useSearchData.getState().setIndexState(bootstrap.indexStatus);
        setWorkspaceDisplayPath(bootstrap.workspaceDisplayPath);
        // Settings + theme apply before first paint of the shell (REQ-021).
        useSettingsData.getState().hydrate(bootstrap.config);
        // Persisted dashboard view restores across restarts (REQ-007); pane
        // layout (REQ-034) hydrates via the workspaceUi settings subscription.
        useWorkspaceData.setState({ view: bootstrap.config.dashboardView });
        setState({ phase: "ready", bootstrap });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiRequestError && error.status === 401) {
          setState({ phase: "denied" });
        } else {
          setState({ phase: "error", message: "Local server unreachable. Restart npx local-notes." });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [hasToken]);

  // System theme follows the OS preference live, without persistence (REQ-021).
  useEffect(() => {
    return watchSystemTheme(() => {
      const { config, previewTheme } = useSettingsData.getState();
      const setting = previewTheme ?? config?.theme ?? "system";
      if (setting === "system") applyTheme("system");
    });
  }, []);

  if (!hasToken) {
    // Dev convenience: Vite dev server without a backend still shows the
    // first-run surface; packaged app always arrives with a fragment token.
    if (import.meta.env.DEV) return <LaunchPage />;
    return <SecureRelaunch />;
  }

  if (state.phase === "denied") return <SecureRelaunch />;

  if (state.phase === "error") {
    return (
      <main className="grid min-h-dvh place-items-center bg-surface-root text-text-secondary">
        <p className="text-body">{state.message}</p>
      </main>
    );
  }

  if (state.phase === "loading") {
    return <main className="min-h-dvh bg-surface-root" aria-busy="true" />;
  }

  return <AppRouter />;
}
