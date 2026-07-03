import type { NoteMetadata } from "../../shared/schemas/notes.js";

/*
 * Deterministic sorting (REQ-008): missing created time sorts AFTER known
 * values in both directions; modified time never substitutes; relative path
 * is the stable tiebreak.
 */
export type SortBy = "name" | "created" | "modified" | "size";
export type SortDirection = "asc" | "desc";

function compareValues(a: NoteMetadata, b: NoteMetadata, by: SortBy): number {
  switch (by) {
    case "name":
      return a.filename.localeCompare(b.filename, undefined, { sensitivity: "base" });
    case "size":
      return a.sizeBytes - b.sizeBytes;
    case "modified":
      return a.modifiedAt.localeCompare(b.modifiedAt);
    case "created": {
      if (a.createdAt === null && b.createdAt === null) return 0;
      // Unknown always AFTER known, regardless of direction - handled by caller flag.
      if (a.createdAt === null) return Number.POSITIVE_INFINITY;
      if (b.createdAt === null) return Number.NEGATIVE_INFINITY;
      return a.createdAt.localeCompare(b.createdAt);
    }
  }
}

export function sortNotes(
  notes: readonly NoteMetadata[],
  by: SortBy,
  direction: SortDirection,
): NoteMetadata[] {
  const sign = direction === "asc" ? 1 : -1;
  return [...notes].sort((a, b) => {
    const raw = compareValues(a, b, by);
    // Infinity markers: unknown-created stays last in BOTH directions.
    if (raw === Number.POSITIVE_INFINITY) return 1;
    if (raw === Number.NEGATIVE_INFINITY) return -1;
    if (raw !== 0) return raw * sign;
    return a.relativePath.localeCompare(b.relativePath);
  });
}
