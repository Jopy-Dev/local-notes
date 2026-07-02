import { lstat, realpath } from "node:fs/promises";
import { dirname, join, sep } from "node:path";
import { AppError } from "../../shared/errors/codes.js";

/*
 * WorkspacePathGuard (MasterPrompt.md 2.4, REQ-027). Single shared guard for
 * every filesystem operation: relative-only input, platform normalization,
 * realpath ancestor containment, symlink/junction rejection for mutable
 * targets. Fails closed with PATH_OUTSIDE_WORKSPACE - message stays generic
 * (7.3: no absolute internal paths in errors).
 */
const CASE_INSENSITIVE = process.platform === "win32" || process.platform === "darwin";

function escapeError(): AppError {
  return new AppError("PATH_OUTSIDE_WORKSPACE", "Path is outside the active workspace.");
}

function normalizeForCompare(path: string): string {
  return CASE_INSENSITIVE ? path.toLowerCase() : path;
}

/* Step 1: relative-only. Reject absolute, control bytes, drive prefix, UNC,
 * empty/dot segments. Screen regex built via fromCharCode - no literal control
 * bytes in source. */
const REJECTED_INPUT = new RegExp(
  `^$|^[A-Za-z]:|^[\\\\/]|[${String.fromCharCode(0)}-${String.fromCharCode(31)}]`,
);
const REJECTED_SEGMENTS = new Set(["", ".", ".."]);

function splitRelativeSegments(candidate: string): string[] {
  if (typeof candidate !== "string" || REJECTED_INPUT.test(candidate)) throw escapeError();
  const segments = candidate.split(/[\\/]/);
  if (segments.some((segment) => REJECTED_SEGMENTS.has(segment))) throw escapeError();
  return segments;
}

export interface ResolveOptions {
  // Mutable-target resolution additionally rejects symlink/junction ancestors.
  forWrite?: boolean;
}

export class WorkspacePathGuard {
  private constructor(private readonly realRoot: string) {}

  /* Root itself must be a real directory - symlink/junction roots rejected (2.2). */
  static async create(root: string): Promise<WorkspacePathGuard> {
    const rootStat = await lstat(root);
    if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) throw escapeError();
    return new WorkspacePathGuard(await realpath(root));
  }

  get root(): string {
    return this.realRoot;
  }

  async resolve(candidate: string, options: ResolveOptions = {}): Promise<string> {
    const forWrite = options.forWrite === true;
    const resolved = join(this.realRoot, ...splitRelativeSegments(candidate));
    const rootCompare = normalizeForCompare(this.realRoot + sep);

    // Containment before any disk access (steps 2-3 + case-normalized step 5).
    this.assertContained(resolved, rootCompare);

    // Step 4-6: realpath the nearest existing ancestor; reject escapes and,
    // for mutable targets, symlink/junction segments along the whole chain.
    const ancestor = await this.findExistingAncestor(resolved, forWrite);
    this.assertContained(await realpath(ancestor), rootCompare);
    if (forWrite) await this.assertChainLinkFree(dirname(ancestor), rootCompare);

    return resolved;
  }

  private assertContained(path: string, rootCompare: string): void {
    if (!normalizeForCompare(path + sep).startsWith(rootCompare)) throw escapeError();
  }

  private async findExistingAncestor(resolved: string, forWrite: boolean): Promise<string> {
    for (let ancestor = resolved; ; ancestor = dirname(ancestor)) {
      const stats = await lstat(ancestor).catch(() => null);
      if (stats) {
        if (forWrite && stats.isSymbolicLink()) throw escapeError();
        return ancestor;
      }
      if (dirname(ancestor) === ancestor) throw escapeError();
    }
  }

  // Swap-race hardening (2.4 step 6): every existing segment between root and
  // target must be link-free, not only the nearest ancestor.
  private async assertChainLinkFree(fromDir: string, rootCompare: string): Promise<void> {
    for (
      let walk = fromDir;
      normalizeForCompare(walk + sep).startsWith(rootCompare) && dirname(walk) !== walk;
      walk = dirname(walk)
    ) {
      const stats = await lstat(walk);
      if (stats.isSymbolicLink()) throw escapeError();
    }
  }
}

/* noteKey = base64url of the normalized POSIX relative path (2.3). Opaque to
 * the frontend; every decode re-validates the boundary. */
export function encodeNoteKey(relativePosixPath: string): string {
  return Buffer.from(relativePosixPath, "utf8").toString("base64url");
}

export function decodeNoteKey(key: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(key)) throw escapeError();
  const decoded = Buffer.from(key, "base64url").toString("utf8");
  // Canonical-form check: re-encoding must reproduce the key exactly.
  if (encodeNoteKey(decoded) !== key) throw escapeError();
  if (decoded.includes("\\")) throw escapeError();
  splitRelativeSegments(decoded);
  return decoded;
}

/* Filename validation (REQ-011): 120-char cap including extension, supported
 * extension, platform-invalid characters, reserved names, trailing dot/space. */
const MAX_FILENAME_LENGTH = 120;
const SUPPORTED_EXTENSION = /\.(md|txt)$/i;
// Platform-invalid characters + ASCII control range; built via fromCharCode
// so no literal control bytes live in source.
const INVALID_CHARS = new RegExp(
  '[\\\\/:*?"<>|' + String.fromCharCode(0) + "-" + String.fromCharCode(31) + "]",
);
const WINDOWS_RESERVED = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;

export type FilenameValidation = { ok: true } | { ok: false; reason: string };

export function validateNoteFilename(name: string): FilenameValidation {
  if (typeof name !== "string" || name.trim().length === 0) {
    return { ok: false, reason: "Filename is required." };
  }
  if (name.length > MAX_FILENAME_LENGTH) {
    return { ok: false, reason: "Filename exceeds 120 characters including extension." };
  }
  const extensionMatch = SUPPORTED_EXTENSION.exec(name);
  if (!extensionMatch) {
    return { ok: false, reason: "Filename must end in .md or .txt." };
  }
  const stem = name.slice(0, -extensionMatch[0].length);
  if (stem.length === 0) {
    return { ok: false, reason: "Filename needs a name before the extension." };
  }
  if (INVALID_CHARS.test(name)) {
    return { ok: false, reason: "Filename contains characters not allowed on supported platforms." };
  }
  if (stem.endsWith(".") || stem.endsWith(" ")) {
    return { ok: false, reason: "Filename cannot end with a dot or space before the extension." };
  }
  if (WINDOWS_RESERVED.test(stem)) {
    return { ok: false, reason: "Filename uses a reserved system name." };
  }
  return { ok: true };
}
