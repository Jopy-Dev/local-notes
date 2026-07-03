import type { SVGProps } from "react";

/*
 * Project-owned UI icons (Design_System.md 8): bundled SVG, currentColor,
 * aria-hidden by default - buttons carry the accessible name.
 */
type IconProps = SVGProps<SVGSVGElement> & { size?: 14 | 15 | 16 | 17 | 18 | 20 | 22 | 24 };

function baseProps({ size = 16, ...rest }: IconProps): SVGProps<SVGSVGElement> {
  return {
    viewBox: "0 0 24 24",
    width: size,
    height: size,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    "aria-hidden": true,
    ...rest,
  };
}

export function NoteFileIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M6.5 3.5h8l3 3v14h-11z" />
      <path d="M14.5 3.5v4h3M9 11h6M9 15h6" />
    </svg>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
    </svg>
  );
}

export function FolderIcon(props: IconProps) {
  return (
    <svg {...baseProps({ strokeWidth: 1.6, ...props })}>
      <path d="M3.5 6.5h6l2 2h9v10h-17z" />
    </svg>
  );
}

export function FolderAddIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M3.5 7h6l2 2h9v9.5h-17z" />
      <path d="M12 11.5v5M9.5 14h5" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="m5 12 4 4 10-10" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="m7 7 10 10M17 7 7 17" />
    </svg>
  );
}

export function DocumentIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M7 3.5h8l3 3v14H7zM15 3.5v4h3" />
    </svg>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <rect x="4" y="10" width="16" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export function MonitorIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

export function NewNoteIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M6.5 3.5h8l3 3v14h-11zM14.5 3.5v4h3M12 11v6M9 14h6" />
    </svg>
  );
}

export function RefreshIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M19 8a7 7 0 1 0 1 6M19 4v4h-4" />
    </svg>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function ArchiveIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M4 7h16v13H4zM3 4h18v3H3zM9 11h6" />
    </svg>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

export function MoreIcon(props: IconProps) {
  return (
    <svg {...baseProps({ ...props, fill: "currentColor", stroke: "none" })}>
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
    </svg>
  );
}

export function FocusEnterIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" />
    </svg>
  );
}

export function FocusExitIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M4 9h5V4M20 9h-5V4M4 15h5v5M20 15h-5v5" />
    </svg>
  );
}

export function MoveNoteIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M3.5 6.5h6l2 2h9v10h-17zM9 13h7M13 10l3 3-3 3" />
    </svg>
  );
}

export function CopyIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <rect x="8" y="8" width="11" height="11" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </svg>
  );
}

export function WarningIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M12 3 2.8 19h18.4zM12 9v4M12 16.5v.5" />
    </svg>
  );
}

export function SplitViewIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M12 4v16" />
    </svg>
  );
}

export function CheckCircleIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <circle cx="12" cy="12" r="8" />
      <path d="m8.5 12 2.2 2.2L15.8 9" />
    </svg>
  );
}

export function SortIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M8 6h10M8 11h7M8 16h4M4 5v14M2 17l2 2 2-2" />
    </svg>
  );
}

export function ListViewIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export function CardViewIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <rect x="4" y="4" width="7" height="7" rx="1" />
      <rect x="13" y="4" width="7" height="7" rx="1" />
      <rect x="4" y="13" width="7" height="7" rx="1" />
      <rect x="13" y="13" width="7" height="7" rx="1" />
    </svg>
  );
}

export function SearchEmptyIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 4 4M8 9h5M8 12h3" />
    </svg>
  );
}
