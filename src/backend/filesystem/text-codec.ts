/*
 * TextFileCodec (MasterPrompt.md 2.3, REQ-014/REQ-032): UTF-8 with optional
 * BOM, fatal decoding (invalid bytes -> unsupported, file NEVER rewritten),
 * consistent LF/CRLF/none detection. Editor state uses LF; save restores the
 * original BOM + line-ending style. Mixed endings normalize to LF by the
 * conservative rule: only files with EXCLUSIVELY CRLF terminators report crlf.
 */
export type TextEncodingKind = "utf8" | "utf8-bom" | "unsupported";
export type LineEndingKind = "lf" | "crlf" | "none";

export interface DecodedTextFile {
  content: string;
  textEncoding: TextEncodingKind;
  lineEnding: LineEndingKind;
}

const BOM_BYTES = [0xef, 0xbb, 0xbf] as const;
const fatalDecoder = new TextDecoder("utf-8", { fatal: true });

function hasBom(bytes: Buffer): boolean {
  return (
    bytes.length >= 3 &&
    bytes[0] === BOM_BYTES[0] &&
    bytes[1] === BOM_BYTES[1] &&
    bytes[2] === BOM_BYTES[2]
  );
}

function detectLineEnding(text: string): LineEndingKind {
  const newlines = text.match(/\r?\n/g);
  if (!newlines || newlines.length === 0) return "none";
  return newlines.every((candidate) => candidate === "\r\n") ? "crlf" : "lf";
}

export function decodeTextFile(bytes: Buffer): DecodedTextFile {
  const bom = hasBom(bytes);
  const body = bom ? bytes.subarray(3) : bytes;
  let raw: string;
  try {
    raw = fatalDecoder.decode(body);
  } catch {
    // Invalid UTF-8: discoverable, read-only, never enters the save pipeline.
    return { content: "", textEncoding: "unsupported", lineEnding: "none" };
  }
  const lineEnding = detectLineEnding(raw);
  return {
    content: raw.replaceAll("\r\n", "\n"),
    textEncoding: bom ? "utf8-bom" : "utf8",
    lineEnding,
  };
}

export function encodeTextFile(
  lfContent: string,
  style: Pick<DecodedTextFile, "textEncoding" | "lineEnding">,
): Buffer {
  if (style.textEncoding === "unsupported") {
    throw new Error("Unsupported-encoding files never enter the save pipeline.");
  }
  const body = style.lineEnding === "crlf" ? lfContent.replaceAll("\n", "\r\n") : lfContent;
  const bodyBytes = Buffer.from(body, "utf8");
  return style.textEncoding === "utf8-bom"
    ? Buffer.concat([Buffer.from(BOM_BYTES), bodyBytes])
    : bodyBytes;
}
