/*
 * Lifecycle-script allowlist gate (MasterPrompt.md 1.5): any lockfile
 * dependency that runs npm install scripts must be explicitly reviewed and
 * listed in scripts/lifecycle-allowlist.json. New entries fail this check
 * until a human reviews the package and adds the exact path@version.
 */
import { readFileSync } from "node:fs";

const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
const allowlist = JSON.parse(readFileSync("scripts/lifecycle-allowlist.json", "utf8"));
const reviewed = new Set(Object.keys(allowlist.reviewed ?? {}));

const offenders = Object.entries(lock.packages ?? {})
  .filter(([, entry]) => entry.hasInstallScript)
  .map(([path, entry]) => `${path}@${entry.version}`)
  .filter((key) => !reviewed.has(key));

if (offenders.length > 0) {
  console.error("Unreviewed lifecycle install scripts in lockfile:");
  for (const offender of offenders) console.error(`  ${offender}`);
  console.error("Review each package, then add the exact entry to scripts/lifecycle-allowlist.json.");
  process.exit(1);
}
console.log(`lifecycle-scripts: OK (${reviewed.size} reviewed, 0 unreviewed)`);
