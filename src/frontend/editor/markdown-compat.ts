import type { CompatibilityScan } from "../../shared/markdown/compatibility-scan.js";
import { scanSourceOnlyConstructs } from "../../shared/markdown/compatibility-scan.js";
import type { MarkdownProbe } from "./markdown-extensions.js";
import { restoreTerminalNewline } from "./markdown-extensions.js";

/*
 * MarkdownCompatibilityService (MasterPrompt.md 4.6): conservative gate for
 * visual editing. Static construct scan first, then the TipTap round-trip
 * with exact normalized equality including the terminal newline. Outcomes
 * cache by versionToken - any content change produces a new token.
 */
const ROUND_TRIP_REASON =
  "Source does not survive the visual editor round-trip losslessly.";
const PARSE_REASON = "Markdown could not be parsed for visual editing.";
const CACHE_CAP = 200;

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

  private evaluate(source: string): CompatibilityScan {
    // Step 1: normalize line endings in memory only - never written back.
    const normalized = source.replaceAll("\r\n", "\n");
    const scan = scanSourceOnlyConstructs(normalized);
    if (scan.compatibility === "source-only") return scan;
    try {
      const serialized = this.probe.serialize(this.probe.parse(normalized));
      const serializedNormalized = restoreTerminalNewline(
        serialized.replaceAll("\r\n", "\n"),
        normalized,
      );
      if (serializedNormalized === normalized) return scan;
      return { compatibility: "source-only", compatibilityReason: ROUND_TRIP_REASON };
    } catch {
      return { compatibility: "source-only", compatibilityReason: PARSE_REASON };
    }
  }
}
