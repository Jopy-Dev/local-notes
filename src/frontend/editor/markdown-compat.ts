import type { CompatibilityScan } from "../../shared/markdown/compatibility-scan.js";
import { scanSourceOnlyConstructs } from "../../shared/markdown/compatibility-scan.js";
import type { MarkdownProbe } from "./markdown-extensions.js";
import { createMarkdownProbe, restoreTerminalNewline } from "./markdown-extensions.js";

/*
 * MarkdownCompatibilityService (MasterPrompt.md 4.6): gate for visual
 * editing. Static construct scan first (frontmatter, footnotes, reference
 * definitions, raw HTML - those WOULD be destroyed and stay source-only).
 * Then the round-trip check compares document STRUCTURE, not text (user
 * feedback round 1, Option A): parse(serialize(parse(src))) must equal
 * parse(src). Identical structure means every textual difference - blank
 * line runs, the serializer own &nbsp; blank paragraphs, marker styles -
 * is representation-only; the file rewrites to the serializer canonical
 * form on the user FIRST real edit, never on open (REQ-015
 * no-write-without-edit). The editor previously locked users out of files
 * it had written itself. Outcomes cache by versionToken.
 */
const ROUND_TRIP_REASON =
  "Source does not survive the visual editor round-trip losslessly.";
const PARSE_REASON = "Markdown could not be parsed for visual editing.";
const CACHE_CAP = 200;

interface DocNode {
  type?: string;
  content?: DocNode[];
}

/*
 * Structure fingerprint for round-trip comparison: trailing EMPTY paragraphs
 * are insignificant - the parser decodes a final "&nbsp;" line into one and
 * the serializer drops it, carrying no content either way.
 */
function structureFingerprint(doc: unknown): string {
  const root = doc as DocNode;
  const content = [...(root.content ?? [])];
  while (content.length > 0) {
    const last = content[content.length - 1]!;
    const empty = last.type === "paragraph" && (last.content?.length ?? 0) === 0;
    if (!empty) break;
    content.pop();
  }
  return JSON.stringify({ ...root, content });
}

export class MarkdownCompatibilityService {
  private readonly cache = new Map<string, CompatibilityScan>();

  constructor(private readonly probe: MarkdownProbe) {}

  check(source: string, versionToken: string): CompatibilityScan {
    const cached = this.cache.get(versionToken);
    if (cached) return cached;
    const outcome = this.evaluate(source);
    if (this.cache.size >= CACHE_CAP) this.cache.clear();
    this.cache.set(versionToken, outcome);
    return outcome;
  }

  /* Uncached check for dirty drafts: re-entering visual mode from source
   * requires fresh round-trip validation (REQ-015). */
  assess(source: string): CompatibilityScan {
    return this.evaluate(source);
  }

  private evaluate(source: string): CompatibilityScan {
    // Step 1: normalize line endings in memory only - never written back.
    const normalized = source.replaceAll("\r\n", "\n");
    const scan = scanSourceOnlyConstructs(normalized);
    if (scan.compatibility === "source-only") return scan;
    try {
      const parsed = this.probe.parse(normalized);
      const serialized = this.probe.serialize(parsed);
      const serializedNormalized = restoreTerminalNewline(
        serialized.replaceAll("\r\n", "\n"),
        normalized,
      );
      // Fast path: textual fixed point.
      if (serializedNormalized === normalized) return scan;
      // Structural fixed point: identical parsed documents = every textual
      // difference is representation-only and safe to canonicalize on edit.
      const reparsed = this.probe.parse(serializedNormalized);
      if (structureFingerprint(reparsed) === structureFingerprint(parsed)) return scan;
      return { compatibility: "source-only", compatibilityReason: ROUND_TRIP_REASON };
    } catch {
      return { compatibility: "source-only", compatibilityReason: PARSE_REASON };
    }
  }
}

/* Lazy singleton: the probe editor is created on the first .md open, never
 * at bundle evaluation time. */
let singleton: MarkdownCompatibilityService | null = null;

export function getCompatibilityService(): MarkdownCompatibilityService {
  singleton ??= new MarkdownCompatibilityService(createMarkdownProbe());
  return singleton;
}
