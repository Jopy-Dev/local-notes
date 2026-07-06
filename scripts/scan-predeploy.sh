#!/usr/bin/env bash
# Pre-deploy local SAST gate per reference/arch/scan-audit.md §26.5.
#
# Runs Semgrep + Trivy fs + Gitleaks in fixed order against the project root.
# Aggregates exit codes — non-zero on ANY HIGH/CRITICAL or scanner error.
#
# Block-on-fail: pass with set +e so all three scanners run even if one fails,
# then aggregate the exit codes for a single decisive result.
#
# Run mode: invoked manually by Claude before `git push origin {main|dev}` at Step 17,
# OR on demand for maintenance / hotfix redeploys. Never wired into CI (CI runs
# its own image scan + npm audit + slop per reference/arch/security.md §9.7).
#
# Prereqs verified per reference/arch/scan-audit.md §26.2.4 version-currency check
# before invocation. Stale scanner = false-green gate.

set +e

echo "=== 1/3 Semgrep (source-code SAST) ==="
# Pinned registry packs via flags: a rules-file listing pack names crashes
# semgrep 1.168 (unroll_dict ValueError). No p/nextjs - Vite/Fastify (ADR-001).
# Excludes mirror .semgrepignore.
semgrep scan --error \
  --config p/typescript --config p/javascript \
  --config p/owasp-top-ten --config p/r2c-security-audit --config p/secrets \
  --exclude node_modules --exclude dist --exclude coverage --exclude .qa
sem_rc=$?
echo ""

echo "=== 2/3 Trivy fs (dep CVEs + IaC misconfig) ==="
trivy fs --scanners vuln,misconfig \
  --severity HIGH,CRITICAL --exit-code 1 \
  --ignorefile .trivyignore .
trv_rc=$?
echo ""

echo "=== 3/3 Gitleaks (secrets — working tree + git history) ==="
gitleaks detect --no-banner --redact --exit-code 1 \
  --config .gitleaks.toml
git_rc=$?
echo ""

echo "=== Aggregate ==="
echo "Semgrep:  exit $sem_rc"
echo "Trivy fs: exit $trv_rc"
echo "Gitleaks: exit $git_rc"
echo ""

if [ $sem_rc -eq 0 ] && [ $trv_rc -eq 0 ] && [ $git_rc -eq 0 ]; then
  echo "PASS — push proceed"
  exit 0
else
  echo "BLOCK — fix all findings before push"
  echo ""
  echo "See reference/arch/scan-policy.md §26.6 for triage."
  echo "Suppression mechanism: per-tool repo files + paired KNOWN_ISSUES.md entry per §26.7."
  exit 1
fi
