/*
 * Package acceptance (MasterPrompt.md 1.5, METRIC-001, ADR-007): npm pack ->
 * install the tarball into an isolated prefix -> launch the installed bin
 * against an isolated HOME -> capability-authenticated /api/v1/health plus
 * the nonce-injected SPA shell respond -> clean shutdown. Fails on any step.
 * The launch runs under scripts/net-guard.cjs (REQ-026): every non-loopback
 * connect is refused and recorded, so the run is the network-disabled launch
 * and the outbound-request test in one.
 */
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const repoRoot = process.cwd();
const stage = mkdtempSync(join(tmpdir(), "local-notes-pkg-"));
const prefix = join(stage, "prefix");
const home = join(stage, "home");
// Windows: npm is a .cmd shim; Node 22 requires shell for those.
const shell = process.platform === "win32";

function fail(message) {
  console.error(`test:package FAIL - ${message}`);
  process.exitCode = 1;
}

let child;
try {
  console.log("pack...");
  execFileSync("npm", ["pack", "--pack-destination", stage], {
    cwd: repoRoot,
    stdio: "inherit",
    shell,
  });
  const tarball = readdirSync(stage).find((name) => name.endsWith(".tgz"));
  if (!tarball) throw new Error("npm pack produced no tarball");

  console.log("install into isolated prefix...");
  execFileSync(
    "npm",
    ["install", "--prefix", prefix, "--prefer-offline", "--no-audit", "--no-fund", join(stage, tarball)],
    { cwd: stage, stdio: "inherit", shell },
  );

  const binDir = join(prefix, "node_modules", ".bin");
  const bin = join(binDir, process.platform === "win32" ? "local-notes.cmd" : "local-notes");

  console.log("launch installed package with isolated HOME + REQ-026 net guard...");
  const guardLog = join(stage, "net-guard.log");
  const started = Date.now();
  child = spawn(bin, [], {
    env: {
      ...process.env,
      HOME: home,
      USERPROFILE: home,
      LOCAL_NOTES_NO_BROWSER: "1",
      // NODE_OPTIONS parsing treats backslash as an escape - forward slashes
      // resolve fine on Windows and survive the .cmd shim.
      NODE_OPTIONS: `--require "${join(repoRoot, "scripts", "net-guard.cjs").replaceAll("\\", "/")}"`,
      LOCAL_NOTES_NET_GUARD_LOG: guardLog,
    },
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
  });

  const capability = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("launch timed out after 30s")), 30_000);
    let output = "";
    const scan = (chunk) => {
      output += String(chunk);
      const match = /#access=([A-Za-z0-9_-]+)/.exec(output);
      if (match) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    };
    child.stdout.on("data", scan);
    child.stderr.on("data", scan);
    child.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`process exited before ready (code ${code}): ${output}`));
    });
  });

  // Loopback HTTP is the product's transport (ADR-003: 127.0.0.1 only, no TLS).
  // nosemgrep: typescript.react.security.react-insecure-request.react-insecure-request
  const health = await fetch("http://127.0.0.1:8989/api/v1/health", {
    headers: { "x-local-notes-token": capability },
  });
  if (health.status !== 200) throw new Error(`/api/v1/health returned ${health.status}`);

  // nosemgrep: typescript.react.security.react-insecure-request.react-insecure-request
  const shellRes = await fetch("http://127.0.0.1:8989/");
  if (shellRes.status !== 200) throw new Error(`SPA shell returned ${shellRes.status}`);
  const html = await shellRes.text();
  if (html.includes("__CSP_NONCE__")) throw new Error("shell served without nonce injection");
  const csp = shellRes.headers.get("content-security-policy") ?? "";
  const nonce = /'nonce-([^']+)'/.exec(csp)?.[1];
  if (!nonce || !html.includes(`content="${nonce}"`)) {
    throw new Error("shell nonce does not match CSP header nonce");
  }

  // REQ-026 acceptance: zero non-loopback requests during the whole launch.
  if (existsSync(guardLog)) {
    const attempts = readFileSync(guardLog, "utf8").trim();
    if (attempts) throw new Error(`REQ-026 outbound request detected:\n${attempts}`);
  }
  console.log(JSON.stringify({ event: "metric.offline.guard", violations: 0, result: "pass" }));

  // METRIC-001 evidence: launch duration to first authenticated response.
  console.log(
    JSON.stringify({
      event: "metric.launch.ready",
      durationMs: Date.now() - started,
      os: process.platform,
      nodeMajor: Number(process.versions.node.split(".")[0]),
      result: "pass",
    }),
  );
  console.log("test:package PASS");
} catch (error) {
  fail(error instanceof Error ? (error.stack ?? error.message) : String(error));
} finally {
  if (child) {
    // Windows: the bin is a .cmd shim - kill the whole tree or the real
    // node server survives and its piped stdio keeps this script alive.
    if (process.platform === "win32") {
      try {
        execFileSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
      } catch {
        /* already exited */
      }
    } else if (!child.killed) {
      child.kill("SIGTERM");
    }
    child.stdout?.destroy();
    child.stderr?.destroy();
  }
  rmSync(stage, { recursive: true, force: true, maxRetries: 5 });
}
