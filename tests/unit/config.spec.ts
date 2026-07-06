import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ConfigService } from "../../src/backend/config/config-service.js";

/*
 * ConfigV1 persistence (MasterPrompt.md 2.7, REQ-021/REQ-032): defaults on
 * first run, per-field fallback with warning, structural corruption blocks
 * startup naming the file, updates validate + persist atomically, workspace
 * field read-only in MVP.
 */
let dir: string;
let service: ConfigService;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "ln-config-"));
  service = new ConfigService(dir);
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const configPath = () => join(dir, "config.json");

describe("ConfigService.load", () => {
  it("creates defaults on first run and persists them", async () => {
    const { config, warnings } = await service.load();
    expect(config.theme).toBe("system");
    expect(config.editorFontSize).toBe(14);
    expect(config.workspace).toBe(dir);
    expect(warnings).toEqual([]);
    expect(existsSync(configPath())).toBe(true);
  });

  it("loads a valid existing file", async () => {
    await service.load();
    const stored = JSON.parse(readFileSync(configPath(), "utf8"));
    stored.theme = "dark";
    writeFileSync(configPath(), JSON.stringify(stored));
    const { config } = await service.load();
    expect(config.theme).toBe("dark");
  });

  it("falls back to exact defaults for invalid individual fields and names them", async () => {
    await service.load();
    const stored = JSON.parse(readFileSync(configPath(), "utf8"));
    stored.editorFontSize = 99;
    stored.lineHeight = 9;
    writeFileSync(configPath(), JSON.stringify(stored));
    const { config, warnings } = await service.load();
    expect(config.editorFontSize).toBe(14);
    expect(config.lineHeight).toBe(1.6);
    expect(warnings.join(" ")).toContain("editorFontSize");
    expect(warnings.join(" ")).toContain("lineHeight");
  });

  it("blocks startup on structural corruption, naming the file", async () => {
    writeFileSync(configPath(), "{broken");
    await expect(service.load()).rejects.toMatchObject({ code: "CONFIG_INVALID" });
    await expect(service.load()).rejects.toThrowError(/config\.json/);
  });

  it("blocks startup on unsupported version", async () => {
    writeFileSync(configPath(), JSON.stringify({ version: 2 }));
    await expect(service.load()).rejects.toMatchObject({ code: "CONFIG_INVALID" });
  });
});

describe("ConfigService.update", () => {
  it("persists a valid partial update", async () => {
    await service.load();
    const updated = await service.update({ theme: "light", editorFontSize: 18 });
    expect(updated.theme).toBe("light");
    expect(JSON.parse(readFileSync(configPath(), "utf8")).editorFontSize).toBe(18);
  });

  it("rejects invalid values with INVALID_SETTING and leaves the file unchanged", async () => {
    await service.load();
    const before = readFileSync(configPath(), "utf8");
    await expect(service.update({ editorFontSize: 3 })).rejects.toMatchObject({
      code: "INVALID_SETTING",
    });
    expect(readFileSync(configPath(), "utf8")).toBe(before);
  });

  it("rejects workspace redirection (read-only in MVP)", async () => {
    await service.load();
    // Cast past the ConfigUpdate type: the runtime double-guard must hold even
    // for callers that bypass the schema-narrowed signature.
    const bypass = { workspace: "elsewhere" } as unknown as Parameters<typeof service.update>[0];
    await expect(service.update(bypass)).rejects.toMatchObject({
      code: "INVALID_SETTING",
    });
  });

  it("serializes concurrent updates without lost writes", async () => {
    await service.load();
    await Promise.all([
      service.update({ theme: "dark" }),
      service.update({ editorFontSize: 16 }),
      service.update({ sortBy: "name" }),
    ]);
    const stored = JSON.parse(readFileSync(configPath(), "utf8"));
    expect(stored.theme).toBe("dark");
    expect(stored.editorFontSize).toBe(16);
    expect(stored.sortBy).toBe("name");
  });
});
