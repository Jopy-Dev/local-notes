#!/usr/bin/env node
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildApp } from "../backend/app.js";
import { startServer } from "../backend/server.js";
import { generateCapability } from "../backend/security/index.js";
import { ConfigService } from "../backend/config/config-service.js";
import { WorkspacePathGuard } from "../backend/filesystem/path-guard.js";
import { initWorkspace } from "../backend/filesystem/workspace-init.js";
import { acquireWorkspaceLock } from "../backend/filesystem/workspace-lock.js";
import type { WorkspaceLock } from "../backend/filesystem/workspace-lock.js";
import {
  LOG_MAX_AGE_DAYS,
  LOG_MAX_TOTAL_BYTES,
  sweepLogs,
} from "../backend/logging/rotation.js";
import { classifyStartupError, EXIT_CODES } from "./exit-codes.js";
import { buildLaunchUrl, openBrowser } from "./launch.js";

/*
 * Bootstrap order (MasterPrompt.md 4.1): config root -> workspace -> lock ->
 * logger maintenance -> config -> Fastify -> browser. Search worker + watcher
 * slot in at Waves 2-3. Startup failure closes initialized resources in
 * reverse order.
 */
const packagedClientRoot = join(dirname(fileURLToPath(import.meta.url)), "../../client");

async function main(): Promise<void> {
  const workspaceRoot = join(homedir(), ".local-notes");
  let lock: WorkspaceLock | undefined;

  try {
    await initWorkspace(workspaceRoot);
    await WorkspacePathGuard.create(workspaceRoot); // rejects symlink/junction root (2.2)
    lock = await acquireWorkspaceLock({
      rootDir: workspaceRoot,
      appVersion: process.env.npm_package_version ?? "0.1.0",
    });

    // Log maintenance failure warns once and never blocks note workflows (4.9).
    await sweepLogs(join(workspaceRoot, "logs"), {
      maxTotalBytes: LOG_MAX_TOTAL_BYTES,
      maxAgeDays: LOG_MAX_AGE_DAYS,
    }).catch(() => console.warn("Log maintenance failed - continuing without cleanup."));

    const configService = new ConfigService(workspaceRoot);
    const { warnings } = await configService.load();
    for (const warning of warnings) console.warn(warning);

    const capability = generateCapability();
    const app = await buildApp({
      capability,
      staticRoot: packagedClientRoot,
      workspaceRoot,
      configService,
    });
    const url = await startServer(app);

    const launchUrl = buildLaunchUrl(capability);
    if (!(await openBrowser(launchUrl))) {
      // One-time URL contains the capability - sensitive until process exit.
      console.log(`Open Local-Notes manually: ${launchUrl}`);
    }
    console.log(`Local-Notes running at ${url} (Ctrl+C to stop)`);

    const shutdown = async () => {
      // Graceful order (1.5); later waves prepend watcher/worker teardown.
      await app.close();
      await lock?.release();
      process.exit(EXIT_CODES.clean);
    };
    process.on("SIGINT", () => void shutdown());
    process.on("SIGTERM", () => void shutdown());
  } catch (error) {
    const exitCode = classifyStartupError(error);
    const message =
      error instanceof Error && error.message ? error.message : "Local-Notes failed to start.";
    if (exitCode === EXIT_CODES.portUnavailable) {
      console.error(
        "Port 8989 is unavailable. Free the port and retry - Local-Notes never selects a different port.",
      );
    } else {
      console.error(message);
    }
    await lock?.release();
    process.exitCode = exitCode;
  }
}

void main();
