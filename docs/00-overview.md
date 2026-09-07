# Orbit HR — Project Overview

Orbit HR is a multi-tenant HR management SaaS. This doc set covers everything
built so far. Read them in order, or jump to what you need:

1. [01-project-setup.md](./01-project-setup.md) — how the frontend was scaffolded, and the two Windows-specific environment issues you'll hit if you set this up fresh
2. [02-frontend-architecture.md](./02-frontend-architecture.md) — folder structure, routing, tech stack, mock data
3. [03-design-system.md](./03-design-system.md) — colors, typography, the shared components (`Tag`, `PersonAvatar`, `StatusIndicator`)
4. [04-bugs-and-fixes.md](./04-bugs-and-fixes.md) — real bugs found via browser testing and how they were fixed, including Base UI gotchas worth knowing before writing more UI code
5. [05-backend.md](./05-backend.md) — the NestJS/Postgres/Prisma API: architecture, modules, auth, and a Prisma CLI landmine worth reading before you touch it
6. [06-auth.md](./06-auth.md) — real login wired to the backend, department landing pages, and which parts of the app still run on mock data vs. the real API
7. [07-production-hardening.md](./07-production-hardening.md) — the production-readiness review's findings and the security/session/timezone work done against it (git+CI, tenant-isolation fixes, httpOnly cookies, rate limiting, invite/reset, tenant timezones)
8. [CHANGELOG.md](./CHANGELOG.md) — chronological log of every change, session by session

## Current state

- **Frontend**: `web/` — Next.js 16 app with 4 working screens (Dashboard,
  Employees, Attendance, Leave) plus real **login** and **department
  landing pages** now wired to the live backend. The screens themselves
  still read from mock in-memory data (`src/lib/mock-data.ts`) — auth is
  the first (and so far only) part of `web/` talking to the real API. See
  [06-auth.md](./06-auth.md).
- **Backend**: `api/` — NestJS 12 + PostgreSQL + Prisma, multi-tenant
  (application-layer isolation — see below), JWT auth in httpOnly cookies
  with rotating refresh tokens, rate limiting, an invite/password-reset
  flow, and tenant-timezone-aware attendance. Modules: auth, employees,
  attendance, leave, tenant. Verified end-to-end (register, login, tenant
  isolation, role-scoped reads, CRUD, leave approval balance updates,
  cookie/refresh/logout, invite/reset, timezone boundaries) — see
  [05-backend.md](./05-backend.md) and
  [07-production-hardening.md](./07-production-hardening.md). Local
  Postgres runs via `docker-compose.yml` at the repo root, and the app now
  has a real git history and CI pipeline
  ([07-production-hardening.md](./07-production-hardening.md)) instead of
  living only on a synced desktop.
- **Not yet done**: connecting the Employees/Attendance/Leave *screens* to
  the real API (they're still mock data even though login is real),
  Postgres row-level security (in progress), branch protection on
  `master`. Full lists in
  [07-production-hardening.md](./07-production-hardening.md#not-yet-done)
  and [06-auth.md](./06-auth.md#known-seams-by-design-not-bugs).

## Stack decisions made so far

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router) | Discussed in initial brainstorm; team already comfortable with React |
| Language | TypeScript | Non-negotiable for domain this data-heavy |
| Styling | Tailwind CSS v4 | Ships with the shadcn template |
| Components | shadcn/ui on **Base UI** (not Radix) | This is the shadcn CLI's current default registry — see [04-bugs-and-fixes.md](./04-bugs-and-fixes.md) for API differences that matter |
| Charts | Recharts via shadcn's `chart.tsx` wrapper | Standard shadcn pairing |
| Font | Inter | Switched from Geist after discovering Geist was never actually loading (see changelog) |
