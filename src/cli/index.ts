#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildApp } from "../backend/app.js";
import { startServer } from "../backend/server.js";
import { generateCapability } from "../backend/security/index.js";
import { classifyStartupError, EXIT_CODES } from "./exit-codes.js";
import { buildLaunchUrl, openBrowser } from "./launch.js";

/*
 * Bootstrap order (MasterPrompt.md 4.1): config root -> workspace -> lock ->
 * logger -> search worker -> watcher -> Fastify -> browser. Wave 0 slice wires
 * server + browser; workspace/lock/logger/worker/watcher land Waves 1-3 and
 * slot into this sequence. Startup failure closes initialized resources in
 * reverse order (currently: server only).
 */
const packagedClientRoot = join(dirname(fileURLToPath(import.meta.url)), "../../client");

async function main(): Promise<void> {
  const capability = generateCapability();
  const app = await buildApp({ capability, staticRoot: packagedClientRoot });

  let url: string;
  try {
    url = await startServer(app);
  } catch (error) {
    const exitCode = classifyStartupError(error);
    if (exitCode === EXIT_CODES.portUnavailable) {
      console.error(
        "Port 8989 is unavailable. Free the port and retry - Local-Notes never selects a different port.",
      );
    } else {
      console.error("Local-Notes failed to start.");
    }
    process.exitCode = exitCode;
    return;
  }

  const launchUrl = buildLaunchUrl(capability);
  const opened = await openBrowser(launchUrl);
  if (!opened) {
    // One-time URL contains the capability - sensitive until process exit.
    console.log(`Open Local-Notes manually: ${launchUrl}`);
  }
  console.log(`Local-Notes running at ${url} (Ctrl+C to stop)`);

  const shutdown = async () => {
    // Graceful order (MasterPrompt.md 1.5); later waves prepend their resources.
    await app.close();
    process.exit(EXIT_CODES.clean);
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

void main();
