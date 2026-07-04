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

- Workflow: Step 0 bootstrap
- Product scope: defined by `project prompt.txt`; formal PRD pending workflow Steps 1-3
- Storage: human-readable `.md` and `.txt` files under `~/.local-notes/`
- Network: fully offline; no cloud services, accounts, telemetry, analytics, or external APIs
