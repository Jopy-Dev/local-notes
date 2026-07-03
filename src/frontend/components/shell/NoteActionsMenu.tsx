import { ArchiveIcon, CopyIcon, MoreIcon, MoveNoteIcon } from "../icons";
import { IconButton } from "../ui/IconButton";
import { MenuButton, MenuSeparator, Popover } from "../ui/Popover";

/*
 * More-actions menu on the editor header (WF-008/009): move and archive open
 * their real dialogs for the open note. Conflict handling is live via the
 * editor state machine (Wave 5) - no preview mock remains.
 */
interface NoteActionsMenuProps {
  open: boolean;
  noteSelected: boolean;
  onToggle: () => void;
  onClose: () => void;
  onAction: (message: string) => void;
  onMoveNote: () => void;
  onArchiveNote: () => void;
}

export function NoteActionsMenu(props: NoteActionsMenuProps) {
  const { open, onClose } = props;

  function run(action: () => void) {
    onClose();
    action();
  }

  return (
    <div className="relative">
      <IconButton label="More note actions" aria-expanded={open} onClick={props.onToggle}>
        <MoreIcon size={16} />
      </IconButton>
      <Popover open={open} onClose={onClose}>
        <MenuButton
          icon={<MoveNoteIcon size={14} />}
          disabled={!props.noteSelected}
          onClick={() => run(props.onMoveNote)}
        >
          Move note
        </MenuButton>
        <MenuButton icon={<CopyIcon size={14} />} onClick={() => run(() => props.onAction("Local path copied"))}>
          Copy local path
        </MenuButton>
        <MenuSeparator />
        <MenuButton
          danger
          icon={<ArchiveIcon size={14} />}
          disabled={!props.noteSelected}
          onClick={() => run(props.onArchiveNote)}
        >
          Archive note
        </MenuButton>
      </Popover>
    </div>
  );
}
