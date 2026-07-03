import { readdir } from "node:fs/promises";
import { extname, join } from "node:path";

/*
 * Notes-tree walk (MasterPrompt.md 4.2): supported files + folder list in one
 * traversal. Skips symlinks/junctions, unsupported extensions, Local-Notes
 * temp artifacts; unreadable directories yield no entries (scan continues).
 */
const SUPPORTED = new Set([".md", ".txt"]);
const TEMP_PREFIX = ".local-notes-tmp-";

export interface WalkedFile {
  absPath: string;
  relPosix: string;
}

export interface WalkResult {
  files: WalkedFile[];
  folders: string[];
}

function isSupportedFile(name: string): boolean {
  return !name.startsWith(TEMP_PREFIX) && SUPPORTED.has(extname(name).toLowerCase());
}

async function walkInto(rootAbs: string, relPrefix: string, result: WalkResult): Promise<void> {
  const entries = await readdir(join(rootAbs, relPrefix), { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const rel = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      result.folders.push(rel);
      await walkInto(rootAbs, rel, result);
    } else if (entry.isFile() && isSupportedFile(entry.name)) {
      result.files.push({ absPath: join(rootAbs, rel), relPosix: rel.replaceAll("\\", "/") });
    }
  }
}

export async function walkNotesTree(rootAbs: string): Promise<WalkResult> {
  const result: WalkResult = { files: [], folders: [] };
  await walkInto(rootAbs, "", result);
  result.folders = result.folders.map((folder) => folder.replaceAll("\\", "/")).sort();
  return result;
}
