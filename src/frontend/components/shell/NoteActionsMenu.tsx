import { ArchiveIcon, CopyIcon, MoreIcon, MoveNoteIcon, WarningIcon } from "../icons";
import { IconButton } from "../ui/IconButton";
import { MenuButton, MenuSeparator, Popover } from "../ui/Popover";

/*
 * More-actions menu on the editor header (move / copy path / conflict preview /
 * archive). Actions are mock toasts at Step 11; real flows land per WF-008/009.
 */
interface NoteActionsMenuProps {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onAction: (message: string) => void;
  onPreviewConflict: () => void;
}

export function NoteActionsMenu({ open, onToggle, onClose, onAction, onPreviewConflict }: NoteActionsMenuProps) {
  function run(message: string) {
    onClose();
    onAction(message);
  }

  return (
    <div className="relative">
      <IconButton label="More note actions" aria-expanded={open} onClick={onToggle}>
        <MoreIcon size={16} />
      </IconButton>
      <Popover open={open} onClose={onClose}>
        <MenuButton icon={<MoveNoteIcon size={14} />} onClick={() => run("Move panel belongs to the production flow")}>
          Move note
        </MenuButton>
        <MenuButton icon={<CopyIcon size={14} />} onClick={() => run("Local path copied")}>
          Copy local path
        </MenuButton>
        <MenuButton
          icon={<WarningIcon size={14} />}
          onClick={() => {
            onClose();
            onPreviewConflict();
          }}
        >
          Preview conflict state
        </MenuButton>
        <MenuSeparator />
        <MenuButton
          danger
          icon={<ArchiveIcon size={14} />}
          onClick={() => run("Archive confirmation belongs to the production flow")}
        >
          Archive note
        </MenuButton>
      </Popover>
    </div>
  );
}
