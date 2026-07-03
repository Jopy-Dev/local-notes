import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { AppError } from "../../shared/errors/codes.js";
import { configV1Schema, defaultConfig } from "../../shared/schemas/config.js";
import type { ConfigV1 } from "../../shared/schemas/config.js";
import { AtomicFileWriter } from "../filesystem/atomic-writer.js";

/*
 * ConfigV1 persistence (MasterPrompt.md 2.7, REQ-021/REQ-032). Structural
 * corruption or unsupported version blocks startup naming the file; invalid
 * individual fields fall back to exact defaults with a warning. Updates
 * validate before persistence, exclude the read-only workspace field, and
 * serialize through one mutex + atomic writes. Migration registry: v1 only;
 * future fromVersion->toVersion entries write atomically and preserve the
 * original on failure.
 */
export class ConfigInvalidError extends Error {
  readonly code = "CONFIG_INVALID";
}

const CONFIG_FILENAME = "config.json";
const structuralSchema = z.object({ version: z.literal(1) }).passthrough();

export interface LoadedConfig {
  config: ConfigV1;
  warnings: string[];
}

export class ConfigService {
  private readonly writer = new AtomicFileWriter();
  private readonly path: string;
  private mutex: Promise<unknown> = Promise.resolve();
  private current: ConfigV1 | null = null;

  constructor(private readonly rootDir: string) {
    this.path = join(rootDir, CONFIG_FILENAME);
  }

  async load(): Promise<LoadedConfig> {
    let raw: string;
    try {
      raw = await readFile(this.path, "utf8");
    } catch {
      const config = defaultConfig(this.rootDir);
      await this.persist(config);
      this.current = config;
      return { config, warnings: [] };
    }

    let structural: z.infer<typeof structuralSchema>;
    try {
      structural = structuralSchema.parse(JSON.parse(raw));
    } catch {
      throw new ConfigInvalidError(
        `${CONFIG_FILENAME} is corrupt or has an unsupported version - fix or delete the file to regenerate defaults.`,
      );
    }

    // Per-field fallback: invalid values take exact defaults + local warning.
    const defaults = defaultConfig(this.rootDir);
    const warnings: string[] = [];
    const merged: Record<string, unknown> = { ...defaults };
    for (const key of Object.keys(configV1Schema.shape) as (keyof ConfigV1)[]) {
      if (key === "version" || key === "workspace") continue;
      const candidate = (structural as Record<string, unknown>)[key];
      const check = configV1Schema.shape[key].safeParse(candidate);
      if (check.success) {
        merged[key] = check.data;
      } else if (candidate !== undefined) {
        warnings.push(`Invalid setting "${key}" reset to default.`);
      }
    }
    const config = configV1Schema.parse(merged);
    this.current = config;
    return { config, warnings };
  }

  async update(partial: Partial<ConfigV1>): Promise<ConfigV1> {
    const task = this.mutex.catch(() => undefined).then(() => this.lockedUpdate(partial));
    this.mutex = task;
    return task;
  }

  private async lockedUpdate(partial: Partial<ConfigV1>): Promise<ConfigV1> {
    if (this.current === null) {
      this.current = (await this.load()).config;
    }
    if ("workspace" in partial || "version" in partial) {
      throw new AppError("INVALID_SETTING", "The workspace path is read-only.", {
        workspace: ["Workspace switching is handled from the launch surface."],
      });
    }
    const candidate = { ...this.current, ...partial };
    const parsed = configV1Schema.safeParse(candidate);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0] ?? "config");
        fieldErrors[field] = [...(fieldErrors[field] ?? []), issue.message];
      }
      throw new AppError("INVALID_SETTING", "One or more settings are invalid.", fieldErrors);
    }
    await this.persist(parsed.data);
    this.current = parsed.data;
    return parsed.data;
  }

  private async persist(config: ConfigV1): Promise<void> {
    await this.writer.write({
      absPath: this.path,
      relPath: CONFIG_FILENAME,
      bytes: Buffer.from(JSON.stringify(config, null, 2), "utf8"),
    });
  }
}
