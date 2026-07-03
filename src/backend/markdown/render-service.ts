import { readFile, lstat } from "node:fs/promises";
import { posix } from "node:path";
import type { WorkspacePathGuard } from "../filesystem/path-guard.js";
import { decodeNoteKey } from "../filesystem/path-guard.js";
import type { CompatibilityScan } from "../../shared/markdown/compatibility-scan.js";
import { scanSourceOnlyConstructs } from "../../shared/markdown/compatibility-scan.js";
import { AppError } from "../../shared/errors/codes.js";
import { renderMarkdown } from "./render-pipeline.js";

/*
 * Markdown preview pipeline service (MasterPrompt.md 4.6, 5.2, REQ-028):
 * sanitized render with the server-side compatibility verdict, plus guarded
 * asset reads for the images that render rewrote to /assets. The frontend
 * compatibility service may still downgrade "edit" after its TipTap
 * round-trip check.
 */
export const ASSET_SIZE_CAP_BYTES = 20 * 1024 * 1024;

const MIME_BY_EXTENSION: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".bmp": "image/bmp",
  ".ico": "image/x-icon",
};

// Magic-byte checks per allowed extension; anything unverifiable is blocked
// so HTML/SVG can never reach the preview as an "image" (7.2).
const SIGNATURES: Record<string, (bytes: Buffer) => boolean> = {
  ".png": (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  ".jpg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  ".jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  ".gif": (b) => b.subarray(0, 3).toString("latin1") === "GIF",
  ".webp": (b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP",
  ".avif": (b) => b.subarray(4, 8).toString("latin1") === "ftyp",
  ".bmp": (b) => b[0] === 0x42 && b[1] === 0x4d,
  ".ico": (b) => b[0] === 0x00 && b[1] === 0x00 && b[2] === 0x01 && b[3] === 0x00,
};

export interface RenderResponse extends CompatibilityScan {
  html: string;
}

export interface AssetResponse {
  bytes: Buffer;
  mime: string;
}

export class MarkdownRenderService {
  constructor(private readonly guard: WorkspacePathGuard) {}

  render(source: string, noteKey: string): RenderResponse {
    const noteRelativePath = decodeOr(noteKey, "INVALID_MARKDOWN", "Render requests need a valid X-Note-Key.");
    const scan = scanSourceOnlyConstructs(source);
    try {
      return { ...scan, ...renderMarkdown(source, noteRelativePath) };
    } catch {
      throw new AppError("INVALID_MARKDOWN", "Markdown could not be rendered.");
    }
  }

  async readAsset(assetKey: string): Promise<AssetResponse> {
    const relative = decodeOr(assetKey, "ASSET_BLOCKED", "Asset path is not allowed.");
    const extension = posix.extname(relative).toLowerCase();
    const mime = MIME_BY_EXTENSION[extension];
    const verify = SIGNATURES[extension];
    if (!mime || !verify) {
      throw new AppError("ASSET_BLOCKED", "Asset type is not allowed.");
    }

    const resolved = await this.guard.resolve(posix.join("save-data", relative)).catch(() => {
      throw new AppError("ASSET_BLOCKED", "Asset path is not allowed.");
    });

    const stats = await lstat(resolved).catch(() => null);
    if (!stats) {
      throw new AppError("ASSET_NOT_FOUND", "Asset does not exist.");
    }
    if (stats.isSymbolicLink() || !stats.isFile()) {
      throw new AppError("ASSET_BLOCKED", "Asset path is not allowed.");
    }
    if (stats.size > ASSET_SIZE_CAP_BYTES) {
      throw new AppError("ASSET_BLOCKED", "Asset exceeds the size cap.");
    }

    const bytes = await readFile(resolved);
    if (!verify(bytes)) {
      throw new AppError("ASSET_BLOCKED", "Asset content does not match its type.");
    }
    return { bytes, mime };
  }
}

function decodeOr(key: string, code: "INVALID_MARKDOWN" | "ASSET_BLOCKED", message: string): string {
  try {
    return decodeNoteKey(key);
  } catch {
    throw new AppError(code, message);
  }
}
