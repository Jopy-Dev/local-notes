/*
 * Production dependency audit gate: `npm audit --omit=dev` must report no
 * high/critical advisory except reviewed entries in
 * scripts/audit-allowlist.json. An allowlist entry fails the gate once it
 * expires or once npm audit stops reporting it, so accepted risk is
 * re-reviewed and removed instead of lingering.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const BLOCKING = new Set(["high", "critical"]);
const GHSA_PATTERN = /GHSA-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4}/;

const allowlist = JSON.parse(readFileSync("scripts/audit-allowlist.json", "utf8"));
const accepted = allowlist.accepted ?? {};

// Windows: npm is a .cmd shim; Node 22 requires shell for those.
const run = spawnSync("npm", ["audit", "--omit=dev", "--json"], {
  encoding: "utf8",
  shell: process.platform === "win32",
  maxBuffer: 32 * 1024 * 1024,
});
let report;
try {
  report = JSON.parse(run.stdout);
} catch {
  console.error("audit: could not parse npm audit --json output");
  console.error(run.stderr);
  process.exit(1);
}
if (report.error) {
  console.error(`audit: npm audit failed - ${report.error.summary ?? report.error.code}`);
  process.exit(1);
}

// Only advisory objects carry a source; string `via` entries are dependents.
const reported = new Map();
for (const vulnerability of Object.values(report.vulnerabilities ?? {})) {
  for (const via of vulnerability.via) {
    if (typeof via !== "object" || !BLOCKING.has(via.severity)) continue;
    const id = GHSA_PATTERN.exec(via.url ?? "")?.[0] ?? `npm-${via.source}`;
    reported.set(id, `${via.name} (${via.severity}) ${via.title}`);
  }
}

const today = new Date().toISOString().slice(0, 10);
const failures = [];
for (const [id, summary] of reported) {
  if (!accepted[id]) failures.push(`unreviewed advisory ${id}: ${summary}`);
  else if (accepted[id].expires < today) failures.push(`allowlist entry ${id} expired ${accepted[id].expires}: re-review`);
}
for (const id of Object.keys(accepted)) {
  if (!reported.has(id)) failures.push(`allowlist entry ${id} no longer reported: remove it`);
}

if (failures.length > 0) {
  console.error("Production dependency audit failed:");
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}
console.log(`audit: OK (${reported.size} high/critical advisories, all reviewed in scripts/audit-allowlist.json)`);
