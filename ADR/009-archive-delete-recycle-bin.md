# ADR-009: Delete Archived Notes to the OS Recycle Bin

- Status: Accepted
- Date: 2026-07-05
- Deciders: User (product owner), Claude (engineering)

## Context

PRD locked "Cannot permanently delete notes in MVP" (Local Operator constraint) and listed
"Permanent delete and archive manager" as out of scope. Archive (REQ-013) was the only
removal path, and nothing could leave `~/.local-notes/save-data/archive/`.

User-feedback round 2 requested an archive browser: the Archive sidebar row lists archived
notes, an archived note opens read-only, and its actions menu includes Delete. This is the
product's first destructive operation, so the shape of Delete was put to the user explicitly
with the PRD conflict named: (a) move the file to the OS recycle bin, or (b) permanent
unlink. The user chose (a).

## Decision

`Delete` exists only for ARCHIVED notes, behind a confirmation dialog that names the file.
It moves the file to the operating-system recycle bin via the pinned `trash` dependency
(MIT; per-OS helper binaries bundled; no network access - REQ-026 posture unchanged).
The application never calls `unlink` on note content. Active notes have no delete action;
archive-then-delete remains the only removal sequence. The trash call is injectable in
`NoteMutationService` so tests never touch the real recycle bin.

PRD updated accordingly: REQ-040 defines the behavior; the Local Operator constraint now
reads "application never permanently deletes note content"; REQ-033 auditability notes the
recycle bin keeps destructive actions recoverable outside the product.

## Consequences

- A mis-click costs two explicit steps (archive, then confirmed delete) and is still
  recoverable from the OS recycle bin afterwards.
- True permanent deletion happens only outside the product (user empties the recycle bin).
- New runtime dependency `trash` passes the admission check but adds bundled helper
  binaries to the packaged tarball; flagged at admission.
- Recycle-bin semantics differ per OS (Windows Recycle Bin, macOS Trash, XDG trash dirs);
  behavior is delegated to the dependency.

## Rejected Alternatives

- Permanent unlink: irreversible after one confirmation; sharpest possible break with the
  product's "nothing is ever lost" promise. Rejected by user.
- App-managed trash folder inside the workspace: recoverable but invents a second archive
  with its own retention/UI questions; the OS already provides exactly this facility.
- No delete at all: rejected by user in round 2 feedback - archives accumulate with no
  disposal path.
