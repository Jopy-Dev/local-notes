import { describe, expect, it } from "vitest";
import { decodeTextFile, encodeTextFile } from "../../src/backend/filesystem/text-codec.js";

/*
 * TextFileCodec (MasterPrompt.md 2.3, REQ-014): fatal UTF-8 decode, BOM and
 * line-ending detection; editor works on LF-normalized content; save restores
 * the original style byte-for-byte.
 */
const BOM = Buffer.from([0xef, 0xbb, 0xbf]);

describe("decodeTextFile", () => {
  it("decodes plain UTF-8 LF content", () => {
    const decoded = decodeTextFile(Buffer.from("line one\nline two\n", "utf8"));
    expect(decoded).toEqual({
      content: "line one\nline two\n",
      textEncoding: "utf8",
      lineEnding: "lf",
    });
  });

  it("detects and strips a UTF-8 BOM", () => {
    const decoded = decodeTextFile(Buffer.concat([BOM, Buffer.from("hello\n", "utf8")]));
    expect(decoded.textEncoding).toBe("utf8-bom");
    expect(decoded.content).toBe("hello\n");
  });

  it("normalizes CRLF to LF in memory and reports crlf", () => {
    const decoded = decodeTextFile(Buffer.from("a\r\nb\r\n", "utf8"));
    expect(decoded.lineEnding).toBe("crlf");
    expect(decoded.content).toBe("a\nb\n");
  });

  it("reports none for single-line content without terminator", () => {
    const decoded = decodeTextFile(Buffer.from("just one line", "utf8"));
    expect(decoded.lineEnding).toBe("none");
  });

  it("flags invalid UTF-8 as unsupported without throwing", () => {
    const decoded = decodeTextFile(Buffer.from([0x68, 0x69, 0xff, 0xfe, 0x00]));
    expect(decoded.textEncoding).toBe("unsupported");
    expect(decoded.content).toBe("");
  });
});

describe("encodeTextFile", () => {
  it("round-trips LF content byte-for-byte", () => {
    const original = Buffer.from("alpha\nbeta\n", "utf8");
    const decoded = decodeTextFile(original);
    const encoded = encodeTextFile(decoded.content, decoded);
    expect(encoded.equals(original)).toBe(true);
  });

  it("restores CRLF line endings on save", () => {
    const original = Buffer.from("alpha\r\nbeta\r\n", "utf8");
    const decoded = decodeTextFile(original);
    const encoded = encodeTextFile(decoded.content, decoded);
    expect(encoded.equals(original)).toBe(true);
  });

  it("restores the BOM on save", () => {
    const original = Buffer.concat([BOM, Buffer.from("alpha\nbeta", "utf8")]);
    const decoded = decodeTextFile(original);
    const encoded = encodeTextFile(decoded.content, decoded);
    expect(encoded.equals(original)).toBe(true);
  });

  it("applies edits while preserving original style", () => {
    const original = Buffer.concat([BOM, Buffer.from("alpha\r\n", "utf8")]);
    const decoded = decodeTextFile(original);
    const encoded = encodeTextFile("alpha\nbeta\n", decoded);
    expect(encoded.equals(Buffer.concat([BOM, Buffer.from("alpha\r\nbeta\r\n", "utf8")]))).toBe(
      true,
    );
  });
});
