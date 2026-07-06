import { FolderAddIcon, FolderIcon } from "./icons";
import { Button } from "./ui/Button";
import { Sidebar } from "./ui/Sidebar";

/*
 * Launch-surface sidebar: empty workspace state + chooser action.
 * Visual parity source: .claude-design/project/index.html sidebar.
 */
interface LaunchSidebarProps {
  onChooseWorkspace: () => void;
}

export function LaunchSidebar({ onChooseWorkspace }: LaunchSidebarProps) {
  return (
    <Sidebar
      label="Workspace navigation"
      eyebrow="Workspace"
      footer={
        <Button
          variant="compact"
          className="w-full justify-start gap-2 px-2 py-2 text-ui"
          onClick={onChooseWorkspace}
        >
          <FolderAddIcon size={15} />
          Choose workspace
        </Button>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col items-start justify-center p-6">
        <span className="mb-3 text-text-muted">
          <FolderIcon size={22} />
        </span>
        <strong className="text-ui font-medium text-text-secondary">No folder selected</strong>
        <p className="mt-1.5 max-w-42.5 text-sm leading-normal text-text-muted">
          Choose a local folder to reveal notes and subfolders here.
        </p>
      </div>
    </Sidebar>
  );
}
