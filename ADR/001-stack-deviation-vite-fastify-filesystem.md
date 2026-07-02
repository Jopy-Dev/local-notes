# ADR-001: React/Vite SPA + Fastify + Filesystem Instead of Standard Next.js Stack

Date: 2026-07-03
Status: Accepted

## Context

The orchestrator's baseline web stack (`arch/core.md` §1) is Next.js App Router + Prisma/PostgreSQL + NextAuth + Redis/Valkey + Sentry + Coolify/VPS deploy. Local-Notes is an offline, single-user, filesystem-first notes workspace launched via `npx local-notes` on the user's own machine (PRD `REQ-001`, `REQ-026`). The product concept (`project prompt.txt`, PRD §1) requires: no cloud services, no accounts, no telemetry, no outbound network traffic, human-readable files as the sole source of truth.

## Decision

Deviate from the baseline stack as recorded in `MasterPrompt.md` §1.2:

- React 19 + Vite 8 SPA served by a local Fastify 5 server (not Next.js App Router / Server Components)
- Fastify REST + SSE on `127.0.0.1:8989` (not API Routes / Server Actions)
- Filesystem adapters under `~/.local-notes/` (not Prisma/PostgreSQL)
- No authentication system; loopback-only Local Operator with per-launch 256-bit capability (not NextAuth) — detail in ADR-003
- Bounded in-memory rate limiter (not Redis/Valkey + rate-limiter-flexible)
- Pino local rotating logs (not Sentry)
- npm package published via GitHub Actions OIDC trusted publishing (not Coolify/VPS/Docker deploy)

## Alternatives Rejected

- **Next.js standalone server shipped as npm package.** Next.js is built for hosted web apps; its server assumes a deploy target, brings App Router/RSC complexity with zero benefit for a loopback SPA, inflates install size substantially, and its build-time prerender model conflicts with a runtime-only local filesystem. A Vite static bundle served by Fastify is smaller, faster to start (`METRIC-002` p95 < 2s), and simpler to reason about.
- **Electron/Tauri desktop app.** Explicitly out of concept — the product contract is "runs in your browser from one npx command." A bundled browser runtime multiplies package size and platform build complexity.
- **SQLite instead of raw filesystem.** Violates the core product promise (PRD `REQ-032`): notes must remain ordinary `.md`/`.txt` files readable without Local-Notes. A database would be a second source of truth and a proprietary wrapper.

## Trade-offs

- We lose the baseline's battle-tested auth/session patterns, Prisma migration tooling, and hosted observability. Mitigations: ADR-003 local security model; versioned `ConfigV1` with migration registry (`MasterPrompt.md` §2.7); local log diagnostics (`REQ-025`).
- We keep: TypeScript strict, Zod validation on every route, Tailwind 4 token system from locked `Design_System.md`, the 17-step workflow gates, slop/gitleaks/scan stack, and branch-protection CI discipline — the deviation is runtime topology, not engineering rigor.

## Consequences

Workflow packs that assume Next.js/Prisma/Coolify (Step 11 scaffold, Step 13 schema, Step 17 deploy) are adapted per `MasterPrompt.md` §1.2-§1.5; deploy target becomes npm publish with provenance. `Implementation_Plan.md` §8 records the full dependency admission table.
