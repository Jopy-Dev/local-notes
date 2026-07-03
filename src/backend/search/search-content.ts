import { open } from "node:fs/promises";
import { CONTENT_INDEX_CAP_BYTES } from "../../shared/schemas/search.js";

/*
 * Indexable content reader (REQ-010/019): reads at most the first 5 MiB and
 * flags truncation; invalid UTF-8 returns null content so the note stays
 * discoverable as metadata-only. Never rewrites or truncates the file itself.
 */
export interface IndexableContent {
  content: string | null;
  truncated: boolean;
}

export async function readIndexableContent(
  absPath: string,
  options: { capBytes?: number } = {},
): Promise<IndexableContent> {
  const capBytes = options.capBytes ?? CONTENT_INDEX_CAP_BYTES;
  const handle = await open(absPath, "r");
  try {
    const { size } = await handle.stat();
    const readBytes = Math.min(size, capBytes);
    const buffer = Buffer.alloc(readBytes);
    await handle.read(buffer, 0, readBytes, 0);
    try {
      // stream:true tolerates a multibyte character sliced at the cap
      // boundary (dropped); interior invalid bytes still throw.
      const content = new TextDecoder("utf-8", { fatal: true }).decode(buffer, {
        stream: size > capBytes,
      });
      return { content, truncated: size > capBytes };
    } catch {
      return { content: null, truncated: false };
    }
  } finally {
    await handle.close();
  }
}
