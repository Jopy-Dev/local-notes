import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/*
 * REQ-026 outbound guard behavior (scripts/net-guard.cjs): a non-loopback
 * connect is refused and recorded before any packet leaves the machine
 * (203.0.113.x is TEST-NET-3, never routable - no real traffic either way);
 * loopback connects pass through untouched.
 */
const guardPath = join(process.cwd(), "scripts", "net-guard.cjs");

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "ln-net-guard-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function runGuarded(script: string, logPath: string): string {
  return execFileSync(process.execPath, ["--require", guardPath, "-e", script], {
    env: { ...process.env, LOCAL_NOTES_NET_GUARD_LOG: logPath, NODE_OPTIONS: "" },
    encoding: "utf8",
    timeout: 15_000,
  });
}

describe("net-guard (REQ-026)", () => {
  it("refuses and records a non-loopback connect", () => {
    const logPath = join(dir, "guard.log");
    const output = runGuarded(
      `
      const net = require("node:net");
      const socket = net.connect(80, "203.0.113.7");
      socket.on("error", (error) => { console.log("BLOCKED " + error.message); process.exit(0); });
      setTimeout(() => { console.log("NOT-BLOCKED"); process.exit(1); }, 5000);
      `,
      logPath,
    );
    expect(output).toContain("BLOCKED");
    expect(output).toContain("REQ-026");
    expect(readFileSync(logPath, "utf8")).toContain("connect 203.0.113.7");
  });

  it("lets loopback connects through", () => {
    const logPath = join(dir, "guard.log");
    const output = runGuarded(
      `
      const net = require("node:net");
      const server = net.createServer((c) => c.end());
      server.listen(0, "127.0.0.1", () => {
        const socket = net.connect(server.address().port, "127.0.0.1", () => {
          console.log("LOOPBACK-OK");
          socket.destroy();
          server.close(() => process.exit(0));
        });
        socket.on("error", () => { console.log("LOOPBACK-BLOCKED"); process.exit(1); });
      });
      `,
      logPath,
    );
    expect(output).toContain("LOOPBACK-OK");
  });
});
