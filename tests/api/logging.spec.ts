import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/backend/app.js";
import { createAppLogging, redactHomePath } from "../../src/backend/logging/logger.js";
import type { AppLogging } from "../../src/backend/logging/logger.js";
import { generateCapability } from "../../src/backend/security/index.js";
import { LOCAL_HOST_HEADER } from "../../src/shared/constants/server.js";

/*
 * REQ-025.logs.integration (MasterPrompt.md 4.9): pino records reach the
 * rotating destination as JSON with operational fields only - query strings
 * (search q), headers (capability token), and raw home paths never land in a
 * record.
 */
let root: string;
let capability: string;
let logging: AppLogging;
let app: FastifyInstance;

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), "ln-logging-"));
  mkdirSync(join(root, "logs"), { recursive: true });
  capability = generateCapability();
  logging = createAppLogging(root, () => {});
  app = await buildApp({ capability, workspaceRoot: root, logger: logging.fastifyLogger });
});

afterEach(async () => {
  await app.close();
  await logging.close();
  rmSync(root, { recursive: true, force: true });
});

async function logText(): Promise<string> {
  await logging.close(); // drains the write queue
  const dir = join(root, "logs");
  return readdirSync(dir)
    .map((name) => readFileSync(join(dir, name), "utf8"))
    .join("");
}

describe("local diagnostics logging (REQ-025)", () => {
  it("writes JSON records without query strings or the capability token", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/health?q=SECRETQUERYTEXT",
      headers: { host: LOCAL_HOST_HEADER, "x-local-notes-token": capability },
    });
    expect(res.statusCode).toBe(200);

    const text = await logText();
    expect(text).toContain('"url":"/api/v1/health"');
    expect(text).not.toContain("SECRETQUERYTEXT");
    expect(text).not.toContain(capability);

    const lines = text.trim().split("\n");
    const record = JSON.parse(lines[0]!) as Record<string, unknown>;
    expect(record).toHaveProperty("reqId");
    expect(record).toHaveProperty("time");
    expect(record).not.toHaveProperty("hostname");
  });

  it("folds the home directory out of error messages", () => {
    expect(redactHomePath(`ENOENT: open '${join(homedir(), "notes", "x.md")}'`)).toBe(
      `ENOENT: open '${join("~", "notes", "x.md")}'`,
    );
    expect(redactHomePath(`${homedir()} twice ${homedir()}`)).toBe("~ twice ~");
  });
});
