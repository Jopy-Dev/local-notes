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
import { LOG_MAX_AGE_DAYS, LOG_MAX_TOTAL_BYTES, sweepLogs } from "../backend/logging/rotation.js";
import { startDiscovery } from "./discovery.js";
import type { DiscoveryStack } from "./discovery.js";
import { classifyStartupError, EXIT_CODES } from "./exit-codes.js";
import { buildLaunchUrl, openBrowser } from "./launch.js";

/*
 * Bootstrap order (MasterPrompt.md 4.1): config root -> workspace -> lock ->
 * log maintenance -> config -> discovery (cache/watcher) -> Fastify ->
 * browser. Search worker joins at Wave 3. Failure closes initialized
 * resources in reverse order.
 */
const packagedClientRoot = join(dirname(fileURLToPath(import.meta.url)), "../../client");

async function main(): Promise<void> {
  const workspaceRoot = join(homedir(), ".local-notes");
  let lock: WorkspaceLock | undefined;
  let discovery: DiscoveryStack | undefined;

  try {
    await initWorkspace(workspaceRoot);
    const guard = await WorkspacePathGuard.create(workspaceRoot); // rejects symlink root (2.2)
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

    discovery = await startDiscovery(guard, workspaceRoot);

    const capability = generateCapability();
    const app = await buildApp({
      capability,
      staticRoot: packagedClientRoot,
      workspaceRoot,
      configService,
      noteRepository: discovery.repository,
      eventBus: discovery.bus,
      searchService: discovery.searchService,
      mutationService: discovery.mutationService,
      operationRegistry: discovery.operationRegistry,
    });
    const url = await startServer(app);

    const launchUrl = buildLaunchUrl(capability);
    if (!(await openBrowser(launchUrl))) {
      // One-time URL contains the capability - sensitive until process exit.
      console.log(`Open Local-Notes manually: ${launchUrl}`);
    }
    console.log(`Local-Notes running at ${url} (Ctrl+C to stop)`);

    const shutdown = async () => {
      // Graceful order (1.5): server -> watcher -> cache flush -> lock.
      await app.close();
      await discovery?.close();
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
    await discovery?.close();
    await lock?.release();
    process.exitCode = exitCode;
  }
}

void main();
