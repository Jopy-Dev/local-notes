import { useEffect, useState } from "react";
import { SecureRelaunch } from "../components/SecureRelaunch";
import { LaunchPage } from "../pages/LaunchPage";
import { ApiRequestError, apiGet } from "../services/api";
import { getCapability } from "../services/token";
import { useSearchData } from "../stores/searchData";
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
