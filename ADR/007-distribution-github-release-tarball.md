# ADR-007: Distribution via GitHub Release Tarball, No npm Publish

Date: 2026-07-04
Status: Accepted

## Context

`MasterPrompt.md` §1.5 planned first publish through npm trusted publishing (GitHub Actions OIDC, provenance) with the repository flipped public at release (`Implementation_Plan.md` §13 infra row). The user's stated intent (2026-07-04, Session Round 23) is strictly local, single-user use: no public distribution, no npm audience, repository stays private. `PRD.md` `REQ-001` assumed first package acquisition via the npm registry.

## Decision

- No npm publish. The `local-notes` package is never pushed to the npm registry; the registry-name-availability recheck in `MasterPrompt.md` §1.5 is void.
- Repository stays private. The "repo public at first publish" row (`Implementation_Plan.md` §13) is retired.
- Official distribution = GitHub Release asset: a release workflow triggered by a version tag runs the full verify gates, `npm pack`, and attaches the tarball (`local-notes-<version>.tgz`, built CLI/server/shared + `dist/client` inside, no build step for the user) to a GitHub Release on the private repository.
- Install contract: download the `.tgz` from the Release page, then `npm install -g ./local-notes-<version>.tgz` once (after which `local-notes` / `npx local-notes` work from anywhere), or run `npx ./local-notes-<version>.tgz` directly. Node.js (per ADR-006 engines range) is the only prerequisite.
- Everything else in `MasterPrompt.md` §1.5 survives unchanged: pack acceptance test in isolated prefix with offline npm cache, package-contents allowlist, lifecycle-script allowlist CI gate, clean-lockfile verify before release.
- `PRD.md` `REQ-001` first-acquisition wording and `README.md` launch contract are updated to the Release-download path in the same Wave 8 PR (Alignment Protocol).

## Alternatives Rejected

- **npm trusted publishing (original plan).** Requires a public package and public repo for provenance value; publishes a personal tool to a global registry with a squatted-name risk surface and maintenance expectations, all serving zero users beyond the owner.
- **Raw source zip (GitHub "Download ZIP").** Ships uncompiled TypeScript; user would need install + build toolchain locally. Violates the one-command usability goal (`METRIC-001`).
- **Private npm registry / GitHub Packages npm.** Adds an auth-token requirement on every install — worse UX than a downloaded tarball for a single user, plus a credential to rotate.

## Trade-offs

- `npx local-notes` no longer works with zero prior steps on a fresh machine — one Release download + one global install first. Acceptable for a single-user tool; offline contract (`REQ-026`) is unchanged after install.
- No npm provenance attestation. Irrelevant with a single trusted consumer who owns the repo.
- Version updates are manual (download new tarball, reinstall). Acceptable; no auto-update was ever in scope.

## Consequences

- Wave 8 adds `.github/workflows/release.yml` (tag -> verify -> pack -> Release asset) instead of a publish workflow.
- `MasterPrompt.md` §1.5 publish lines, `PRD.md` `REQ-001` acquisition line, `ARCHITECTURE.md` §5 integration note, and `README.md` launch contract update in the Wave 8 PR.
- Step 17-equivalent gate (predeploy scan stack) runs before tagging a release instead of before `npm publish`.
