import { posix } from "node:path";
import { encodeNoteKey } from "../filesystem/path-guard.js";

/*
 * Link + image classification for the render pipeline (MasterPrompt.md 4.6,
 * REQ-014/028): every reference is re-classified server-side regardless of
 * what the source claims. Notes resolve to internal routes, raster assets to
 * the guarded asset endpoint; everything else is blocked inert.
 */
const NOTE_EXTENSIONS = new Set([".md", ".txt"]);
const ASSET_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".bmp", ".ico"]);
const HAS_SCHEME = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

export interface ClassifiedTag {
  tagName: string;
  attribs: Record<string, string>;
  text?: string;
}

/*
 * Resolve a note-relative reference inside the save-data namespace. Returns
 * the save-data-relative POSIX path, or null when the target escapes it.
 * noteRelativePath is notes-root-relative, so references resolve against
 * "notes/<note folder>" (MasterPrompt.md 2.2).
 */
function resolveWorkspaceRelative(reference: string, noteRelativePath: string): string | null {
  const decoded = safeDecode(reference);
  if (decoded === null || decoded.includes("\0") || decoded.startsWith("/") || decoded.startsWith("\\")) {
    return null;
  }
  const baseDir = posix.join("notes", posix.dirname(noteRelativePath));
  const resolved = posix.normalize(posix.join(baseDir, decoded.replaceAll("\\", "/")));
  if (resolved.startsWith("..") || posix.isAbsolute(resolved)) return null;
  return resolved;
}

function safeDecode(reference: string): string | null {
  try {
    return decodeURIComponent(reference);
  } catch {
    return null;
  }
}

export function classifyLink(href: string | undefined, noteRelativePath: string): ClassifiedTag {
  if (!href) return { tagName: "span", attribs: { "data-blocked": "link" } };
  if (href.startsWith("#")) return { tagName: "a", attribs: { href, "data-link": "fragment" } };
  if (HAS_SCHEME.test(href)) {
    if (/^https?:/i.test(href)) {
      // External links need explicit confirmation client-side (REQ-014).
      return { tagName: "a", attribs: { href, rel: "noreferrer", "data-link": "external" } };
    }
    return { tagName: "span", attribs: { "data-blocked": "link" } };
  }
  const resolved = resolveWorkspaceRelative(href, noteRelativePath);
  if (!resolved || !resolved.startsWith("notes/")) {
    return { tagName: "span", attribs: { "data-blocked": "link" } };
  }
  const extension = posix.extname(resolved).toLowerCase();
  if (!NOTE_EXTENSIONS.has(extension)) {
    return { tagName: "span", attribs: { "data-blocked": "link" } };
  }
  const notesRelative = resolved.slice("notes/".length);
  return {
    tagName: "a",
    attribs: { href: `/notes/${encodeNoteKey(notesRelative)}`, "data-link": "internal" },
  };
}

export function classifyImage(
  src: string | undefined,
  alt: string | undefined,
  noteRelativePath: string,
): ClassifiedTag {
  const blocked = {
    tagName: "span",
    attribs: { "data-blocked": "image" },
    text: alt ? `Blocked image: ${alt}` : "Blocked image",
  };
  if (!src || HAS_SCHEME.test(src) || src.startsWith("//")) return blocked;
  const resolved = resolveWorkspaceRelative(src, noteRelativePath);
  if (!resolved || !ASSET_EXTENSIONS.has(posix.extname(resolved).toLowerCase())) return blocked;
  return {
    tagName: "img",
    attribs: { src: `/api/v1/assets/${encodeNoteKey(resolved)}`, alt: alt ?? "" },
  };
}
