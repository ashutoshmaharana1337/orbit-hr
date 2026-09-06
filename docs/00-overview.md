# Orbit HR — Project Overview

Orbit HR is a multi-tenant HR management SaaS. This doc set covers everything
built so far. Read them in order, or jump to what you need:

1. [01-project-setup.md](./01-project-setup.md) — how the frontend was scaffolded, and the two Windows-specific environment issues you'll hit if you set this up fresh
2. [02-frontend-architecture.md](./02-frontend-architecture.md) — folder structure, routing, tech stack, mock data
3. [03-design-system.md](./03-design-system.md) — colors, typography, the shared components (`Tag`, `PersonAvatar`, `StatusIndicator`)
4. [04-bugs-and-fixes.md](./04-bugs-and-fixes.md) — real bugs found via browser testing and how they were fixed, including Base UI gotchas worth knowing before writing more UI code
5. [05-backend.md](./05-backend.md) — the NestJS/Postgres/Prisma API: architecture, modules, auth, and a Prisma CLI landmine worth reading before you touch it
6. [06-auth.md](./06-auth.md) — real login wired to the backend, department landing pages, and which parts of the app still run on mock data vs. the real API
7. [CHANGELOG.md](./CHANGELOG.md) — chronological log of every change, session by session

## Current state

- **Frontend**: `web/` — Next.js 16 app with 4 working screens (Dashboard,
  Employees, Attendance, Leave) plus real **login** and **department
  landing pages** now wired to the live backend. The screens themselves
  still read from mock in-memory data (`src/lib/mock-data.ts`) — auth is
  the first (and so far only) part of `web/` talking to the real API. See
  [06-auth.md](./06-auth.md).
- **Backend**: `api/` — NestJS 12 + PostgreSQL + Prisma, multi-tenant
  (application-layer isolation), JWT auth, role-based guards. Modules:
  auth, employees, attendance, leave. Verified end-to-end (register, login,
  tenant isolation, CRUD, leave approval balance updates) — see
  [05-backend.md](./05-backend.md). Local Postgres runs via
  `docker-compose.yml` at the repo root. 6 seeded logins, one per
  department (see [06-auth.md](./06-auth.md#logins-seeded-password-password123-for-all)).
- **Not yet done**: connecting the Employees/Attendance/Leave *screens* to
  the real API (they're still mock data even though login is real), an
  employee-invite flow (only the original tenant registrant can register
  a brand-new tenant; the 6 seeded logins were added directly via the seed
  script, not a self-serve invite), Postgres row-level security. Full
  lists in [05-backend.md](./05-backend.md#whats-not-done-yet) and
  [06-auth.md](./06-auth.md#known-seams-by-design-not-bugs).

## Stack decisions made so far

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router) | Discussed in initial brainstorm; team already comfortable with React |
| Language | TypeScript | Non-negotiable for domain this data-heavy |
| Styling | Tailwind CSS v4 | Ships with the shadcn template |
| Components | shadcn/ui on **Base UI** (not Radix) | This is the shadcn CLI's current default registry — see [04-bugs-and-fixes.md](./04-bugs-and-fixes.md) for API differences that matter |
| Charts | Recharts via shadcn's `chart.tsx` wrapper | Standard shadcn pairing |
| Font | Inter | Switched from Geist after discovering Geist was never actually loading (see changelog) |
