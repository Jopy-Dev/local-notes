import { useEffect, useRef, useState } from "react";
import { SettingsIcon } from "../components/icons";
import { LaunchSidebar } from "../components/LaunchSidebar";
import { LaunchStatusBar } from "../components/LaunchStatusBar";
import { WorkspaceDialog } from "../components/WorkspaceDialog";
import { IconButton } from "../components/ui/IconButton";
import { NavBar } from "../components/ui/NavBar";
import { Toast } from "../components/ui/Toast";
import { UnsupportedViewport, useViewportSupported } from "../components/ui/UnsupportedViewport";
import { WorkspaceLaunchPanel } from "../components/ui/WorkspaceLaunchPanel";

/*
 * Launch / first-run screen (REQ-001/002 surface). Visual parity source:
 * .claude-design/project/index.html. Workspace selection is mock at Step 11;
 * real config/bootstrap wiring lands at Step 12+.
 */
const TOAST_VISIBLE_MS = 2200;

export function LaunchPage() {
  const supported = useViewportSupported();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "o") {
        event.preventDefault();
        setDialogOpen(true);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  function showToast() {
    clearTimeout(toastTimer.current);
    setToastVisible(true);
    toastTimer.current = setTimeout(() => setToastVisible(false), TOAST_VISIBLE_MS);
  }

  function confirmWorkspace() {
    setDialogOpen(false);
    showToast();
  }

  if (!supported) {
    return <UnsupportedViewport />;
  }

  return (
    <div className="grid h-dvh w-full grid-cols-[244px_minmax(0,1fr)] grid-rows-[42px_minmax(0,1fr)_24px] bg-surface-root [grid-template-areas:'titlebar_titlebar'_'sidebar_main'_'status_status']">
      <NavBar
        windowTitle="No workspace open"
        actions={
          <IconButton label="Open settings" title="Settings">
            <SettingsIcon size={16} />
          </IconButton>
        }
      />
      <LaunchSidebar onChooseWorkspace={() => setDialogOpen(true)} />
      <main className="launch-grid-bg grid min-h-0 min-w-0 place-items-center overflow-auto p-14 [grid-area:main]">
        <WorkspaceLaunchPanel
          onChooseFolder={() => setDialogOpen(true)}
          onUseDefault={showToast}
        />
      </main>
      <LaunchStatusBar />
      <WorkspaceDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onConfirm={confirmWorkspace}
      />
      <Toast visible={toastVisible}>Workspace selection simulated</Toast>
    </div>
  );
}
