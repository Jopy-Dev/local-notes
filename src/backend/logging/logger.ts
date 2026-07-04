import { homedir } from "node:os";
import { join } from "node:path";
import {
  LOG_MAX_AGE_DAYS,
  LOG_MAX_FILE_BYTES,
  LOG_MAX_TOTAL_BYTES,
  RotatingLogDestination,
  sweepLogs,
} from "./rotation.js";

/*
 * Pino wiring for local diagnostics (MasterPrompt.md 4.9, REQ-025): JSON
 * records carry operational fields only. The req serializer strips query
 * strings (a search q is user content and never logged) and emits no headers
 * (the capability token travels in one); base is dropped so no pid/hostname
 * lands in records; error messages fold the home directory to `~`. Lines
 * stream to the rotating destination; retention runs at startup and hourly.
 * Maintenance failure warns once and never crashes note workflows.
 */
const HOUR_MS = 60 * 60 * 1000;

export interface AppLogging {
  /* Fastify `logger` options: JSON records into the rotating destination. */
  fastifyLogger: object;
  runRetention: () => Promise<void>;
  startRetentionJob: () => void;
  close: () => Promise<void>;
}

export function redactHomePath(message: string): string {
  return message.split(homedir()).join("~");
}

export function createAppLogging(
  workspaceRoot: string,
  onMaintenanceFailure: () => void,
): AppLogging {
  const logsDir = join(workspaceRoot, "logs");
  const destination = new RotatingLogDestination(logsDir, { maxFileBytes: LOG_MAX_FILE_BYTES });
  let warned = false;
  const warnOnce = () => {
    if (warned) return;
    warned = true;
    onMaintenanceFailure();
  };
  let timer: ReturnType<typeof setInterval> | undefined;

  const runRetention = async () => {
    await sweepLogs(logsDir, {
      maxTotalBytes: LOG_MAX_TOTAL_BYTES,
      maxAgeDays: LOG_MAX_AGE_DAYS,
    }).catch(warnOnce);
  };

  return {
    fastifyLogger: {
      level: "info",
      base: undefined,
      serializers: {
        req: (request: { method: string; url: string }) => ({
          method: request.method,
          url: request.url.split("?")[0],
        }),
        res: (reply: { statusCode: number }) => ({ statusCode: reply.statusCode }),
        err: (error: { name?: string; code?: string; message?: string }) => ({
          ...(error.name ? { type: error.name } : {}),
          ...(error.code ? { code: error.code } : {}),
          message: redactHomePath(error.message ?? ""),
        }),
      },
      stream: {
        write: (line: string) => {
          void destination.write(line).catch(warnOnce);
        },
      },
    },
    runRetention,
    startRetentionJob: () => {
      timer = setInterval(() => void runRetention(), HOUR_MS);
      timer.unref?.();
    },
    close: async () => {
      if (timer) clearInterval(timer);
      await destination.close();
    },
  };
}
