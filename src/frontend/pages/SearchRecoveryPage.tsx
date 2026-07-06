import { useEffect } from "react";
import { SearchRecoveryPanel } from "../components/ui/SearchRecoveryPanel";
import { navigate } from "../services/navigation";
import { useSearchData } from "../stores/searchData";
import { useWorkspaceData } from "../stores/workspaceData";

/*
 * SCREEN-007 /recovery/search (WF-011): explains the degraded index and owns
 * the explicit rebuild action. Index state stays live through the shared SSE
 * subscription; editing remains available throughout.
 */
export function SearchRecoveryPage() {
  const indexState = useSearchData((state) => state.indexState);
  const rebuildRequested = useSearchData((state) => state.rebuildRequested);
  const startRebuild = useSearchData((state) => state.startRebuild);

  // Keep index.status events flowing while this page is the active route.
  useEffect(() => useWorkspaceData.getState().connectEvents(), []);

  return (
    <main className="grid min-h-dvh place-items-center bg-surface-root p-6">
      <SearchRecoveryPanel
        state={indexState}
        rebuildRequested={rebuildRequested}
        onRebuild={() => void startRebuild()}
        onBack={() => navigate("/")}
      />
    </main>
  );
}
