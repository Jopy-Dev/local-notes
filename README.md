# Local-Notes

Application type: `web app`

Offline, filesystem-first notes workspace served by a local Node.js/Fastify server with a React/Vite browser interface.

Launch contract (install once from a GitHub Release tarball per ADR-007, then):

```bash
npx local-notes
```

Local URL: `http://127.0.0.1:8989`

Project concept authority: `project prompt.txt`

## Status

- Release: `v1.0.0` GitHub Release tarball (ADR-007); install `npm install -g ./local-notes-1.0.0.tgz`, then `npx local-notes`
- Workflow: Step 15 (feature-complete local build in daily use)
- Storage: human-readable `.md` and `.txt` files under `~/.local-notes/`
- Network: fully offline; no cloud services, accounts, telemetry, analytics, or external APIs
