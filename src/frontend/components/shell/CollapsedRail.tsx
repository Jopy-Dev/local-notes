import { ChevronRightIcon } from "../icons";
import { IconButton } from "../ui/IconButton";
import type { PaneKind } from "../../stores/workspaceUi";

/*
 * Collapsed pane rail (REQ-034): 28px strip holding the expand affordance;
 * the pre-collapse width restores from session state on expand.
 */
export function CollapsedRail({ pane, onExpand }: { pane: PaneKind; onExpand: () => void }) {
  return (
    <div className="flex h-full w-full flex-col items-center border-r border-border-subtle bg-surface-sidebar pt-1.5">
      <IconButton
        label={pane === "folder" ? "Expand folder pane" : "Expand note list pane"}
        onClick={onExpand}
      >
        <ChevronRightIcon size={14} />
      </IconButton>
    </div>
  );
}
