# Orbit HR

A multi-tenant HR management SaaS — core HR, attendance, and leave
management — built from scratch on Next.js and NestJS.

[![CI](https://github.com/ashutoshmaharana1337/orbit-hr/actions/workflows/ci.yml/badge.svg)](https://github.com/ashutoshmaharana1337/orbit-hr/actions/workflows/ci.yml)

## What's here

- **`web/`** — Next.js 16 frontend. Dashboard, Employees, Attendance, and
  Leave screens, all wired to the live API. Real login, per-department landing
  pages, and all four main screens fetch live data via TanStack Query. Mock
  data completely removed — see [docs/08-frontend-live-data.md](docs/08-frontend-live-data.md).
- **`api/`** — NestJS 12 + PostgreSQL + Prisma backend. Multi-tenant, with
  tenant isolation enforced at *both* the application layer (every query
  scoped by `tenantId`) and the database layer (Postgres row-level
  security).
- **`docs/`** — a full doc set covering how this was built, a
  production-readiness review, and the hardening work done against it.

## Quick start

Prerequisites: Node 22 (see `.nvmrc`), Docker.

```bash
# Postgres
docker compose up -d

# API
cd api
npm install
npx prisma generate            # .npmrc disables install scripts — see api/README.md
cp .env.example .env           # fill in the two DB URLs, see "Two database connections" below
npx prisma migrate deploy
npm run prisma:seed
npm run start:dev              # http://localhost:3001/api

# Web (new terminal)
cd web
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:3001/api" > .env.local
npm run dev                    # http://localhost:3000
```

Seeded login: `girija.kuanr@acme.dev` / `password123` (ADMIN, tenant
"Acme Inc.", 15 employees). Five more seeded logins — one MANAGER per
other department — are listed in
[docs/06-auth.md](docs/06-auth.md#logins-seeded-password-password123-for-all).

### Two database connections

`api/.env.example` asks for both `DATABASE_URL` and `DIRECT_DATABASE_URL`.
The app's runtime connection (`DATABASE_URL`) uses a restricted,
non-superuser Postgres role — a superuser or table owner bypasses row-level
security entirely regardless of policy, so the app deliberately doesn't
connect as one. `DIRECT_DATABASE_URL` is the privileged role that
`prisma migrate`/`generate` use to create that restricted role and manage
RLS policies; it's never used at runtime. See
[docs/07-production-hardening.md](docs/07-production-hardening.md#high-postgres-row-level-security)
for the full reasoning.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS v4, shadcn/ui on Base UI |
| Backend | NestJS 12, Prisma 6.19, PostgreSQL 16 |
| Auth | JWT access tokens in httpOnly cookies, rotating refresh tokens, role-based access control |
| Testing | Vitest — unit tests and an e2e suite that runs against a real Postgres |
| CI | GitHub Actions — lint, typecheck, test, build on every PR and push to `master` |

## Security

- Tenant isolation enforced twice, independently: every query is scoped by
  `tenantId` in application code, *and* Postgres row-level security refuses
  a cross-tenant row even if a query forgets that filter.
- Role-based access control (`ADMIN`/`HR`/`MANAGER`/`EMPLOYEE`) with
  per-role read visibility, not just write gating.
- httpOnly cookie sessions with rotating, hashed refresh tokens; replaying
  a rotated-out token revokes the whole session family.
- Rate limiting (`@nestjs/throttler`) and `helmet` security headers.
- An invite flow and password reset, with a pluggable mail service (logs
  the email in dev when no provider is configured, so the flow is fully
  testable without a real account).

Full detail, plus what's *not* done yet, in
[docs/07-production-hardening.md](docs/07-production-hardening.md).

## Project status

This started from a full tech-lead-style production-readiness review
([docs/production-readiness-review.html](docs/production-readiness-review.html))
that scored the project "Not yet" and laid out a phased roadmap. Phases 0
(foundations — git, CI), 1 (security and correctness), and 2 (frontend wired
to real API) are complete. Phase 3 onward (completing the data model, infra,
observability) is still ahead. Current state in full detail:
[docs/00-overview.md](docs/00-overview.md).

## Documentation

Read the doc set in order starting at
[docs/00-overview.md](docs/00-overview.md), or jump straight to:

- [docs/05-backend.md](docs/05-backend.md) — API architecture and modules
- [docs/06-auth.md](docs/06-auth.md) — auth flow and seeded logins
- [docs/07-production-hardening.md](docs/07-production-hardening.md) — the security/session/RLS work
- [docs/CHANGELOG.md](docs/CHANGELOG.md) — session-by-session history
