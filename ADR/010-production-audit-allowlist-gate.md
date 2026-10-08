# ADR-010: Production Audit Gate With a Reviewed Allowlist

- Status: Accepted
- Date: 2026-10-08
- Deciders: User (product owner), Claude (engineering)

## Context

CI and the release workflow gated on `npm audit --omit=dev --audit-level=high`. By
2026-10 that gate failed on `dev` itself: 13 high advisories had landed against the
shipped v1.5.0 dependency tree (Fastify stack, `sanitize-html`, and transitive packages).
Every PR was blocked, including the Dependabot update PRs.

All of them have patched releases except one. `braces` (GHSA-vfj7-8cjw-p6xm, stack
exhaustion on deeply nested patterns) has no fixed version: `3.0.3` is both the latest
release and vulnerable. It reaches the app only through `trash` -> `globby` -> `fast-glob`
-> `micromatch` -> `braces`. Plain `npm audit` has no way to accept a single reviewed
advisory, so with `braces` installed the gate can never pass again.

Triage also showed that `trash` globs its input by default. An archived note named
`report[1].md` would also send a sibling `report1.md` to the recycle bin on POSIX paths.
The app now calls `trash(path, { glob: false })`, which fixes that defect and means
globby/braces never run.

Options put to the user:

1. `glob: false` plus an allowlist gate that accepts only reviewed advisory IDs.
2. Downgrade `trash` to 9.0.0. Its older globby chain avoids `braces`, but the
   downgrade drops the trash 10 fixes.
3. Drop `trash` and write per-OS recycle-bin code. That adds new platform-specific
   risk on the only destructive path (ADR-009).

The user chose option 1.

## Decision

`scripts/check-audit.mjs` replaces the raw `npm audit` step in `.github/workflows/ci.yml`
and `.github/workflows/release.yml`. It runs `npm audit --omit=dev --json` and fails when:

- a high or critical advisory is not listed in `scripts/audit-allowlist.json`;
- an allowlist entry is past its `expires` date;
- an allowlist entry is no longer reported, so a fixed advisory must be removed.

The local pre-deploy Trivy scan suppresses the same advisory under its CVE alias in
`.trivyignore`, using the same `exp:` date.

Each allowlist entry names the package, the reachability argument, and its paired
`KNOWN_ISSUES.md` Suppressions row. The script adds no dependency, in the same style as
`scripts/check-lifecycle-scripts.mjs`.

## Consequences

- Accepted risk is explicit, reviewed, and time-boxed. An expired entry blocks CI the
  same way a new advisory does.
- Moderate and low advisories still pass the gate, as they did under
  `--audit-level=high`. Dev-only advisories stay out of scope (`--omit=dev`).
- When an advisory has a fix, the gate forces the allowlist entry out once the fix is
  installed. Stale suppressions cannot linger.
- If the npm audit JSON shape changes, the gate fails closed: a parse failure exits
  non-zero.
