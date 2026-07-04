import type { NoteListEntry } from "../components/ui/NoteListItem";

/*
 * Step 11 mock workspace data for the app-shell parity screen. Real data
 * arrives from the notes/folders/search APIs at Step 12+ (workflow/repo-env.md
 * 11c: mock data until real wiring).
 */
export const TOTAL_NOTES = 248;

export const mockNotes: readonly NoteListEntry[] = [
  {
    key: "architecture",
    title: "Local Notes architecture",
    time: "10:42",
    preview:
      "Single-process runtime, filesystem ownership, search worker, and browser security contract.",
    fileType: "MD",
    path: "Projects / Local Notes",
  },
  {
    key: "launch-checklist",
    title: "Launch checklist",
    time: "09:18",
    preview: "Package validation, port ownership, browser launch, and graceful shutdown checks.",
    fileType: "MD",
    path: "Projects / Local Notes",
  },
  {
    key: "friday-review",
    title: "Friday review",
    time: "Yesterday",
    preview: "Decisions made, unresolved questions, and tasks to resume next week.",
    fileType: "MD",
    path: "Daily",
  },
  {
    key: "search-benchmark",
    title: "Search benchmark notes",
    time: "Jun 11",
    preview: "Warm-index measurements across ten thousand generated Markdown and text files.",
    fileType: "TXT",
    path: "Research",
    metadataOnly: true,
  },
  {
    key: "markdown-compat",
    title: "Markdown compatibility",
    time: "Jun 10",
    preview:
      "Lossless round-trip fixtures for links, tables, task lists, code fences, and underline HTML.",
    fileType: "MD",
    path: "Reference",
  },
  {
    key: "fs-edge-cases",
    title: "Filesystem edge cases",
    time: "Jun 9",
    preview:
      "Symlinks, junctions, case-insensitive collisions, rename events, and invalid UTF-8 behavior.",
    fileType: "MD",
    path: "Research",
  },
  {
    key: "keyboard-map",
    title: "Keyboard map",
    time: "Jun 8",
    preview: "Primary navigation and editing shortcuts, focus return rules, and conflict actions.",
    fileType: "TXT",
    path: "Reference",
  },
];

export interface MockFolderEntry {
  key: string;
  label: string;
  count: number;
  iconKind: "note" | "clock" | "archive" | "folder";
  indent?: boolean;
}

export const mockLibrary: readonly MockFolderEntry[] = [
  { key: "all", label: "All notes", count: 248, iconKind: "note" },
  { key: "recent", label: "Recent", count: 12, iconKind: "clock" },
  { key: "archive", label: "Archive", count: 31, iconKind: "archive" },
];

export const mockFolders: readonly MockFolderEntry[] = [
  { key: "daily", label: "Daily", count: 64, iconKind: "folder" },
  { key: "projects", label: "Projects", count: 88, iconKind: "folder" },
  { key: "projects/local-notes", label: "Local Notes", count: 17, iconKind: "folder", indent: true },
  { key: "projects/website", label: "Website refresh", count: 23, iconKind: "folder", indent: true },
  { key: "research", label: "Research", count: 52, iconKind: "folder" },
  { key: "reference", label: "Reference", count: 44, iconKind: "folder" },
];

export const mockBreadcrumbs = ["Projects", "Local Notes", "local-notes-architecture.md"] as const;
export const SORT_OPTIONS = ["Modified", "Created", "Title"] as const;
