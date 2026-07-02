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
