import { LaunchPage } from "../pages/LaunchPage";
import { WorkspaceShellPage } from "../pages/WorkspaceShellPage";

// Temporary path switch for the Step 11 parity screens. Replaced by
// AppRouter (MasterPrompt.md 1.6) at Step 12.
export function App() {
  if (window.location.pathname === "/shell") {
    return <WorkspaceShellPage />;
  }
  return <LaunchPage />;
}
