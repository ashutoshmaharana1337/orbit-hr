# Production Hardening

`docs/production-readiness-review.html` — a tech-lead-style review of the
codebase as of 5 Sep 2026 — gave a verdict of **"Not yet"** and a phased
roadmap. This doc tracks progress against that roadmap's phases 0 and 1
(foundations, and security/correctness). Phases 2–6 (wiring the frontend
off mock data, completing the data model, testing, infra, observability)
are still ahead.

Every change below shipped as its own small PR against
[github.com/ashutoshmaharana1337/orbit-hr](https://github.com/ashutoshmaharana1337/orbit-hr),
verified with `lint` + `typecheck` + unit tests + a real-Postgres e2e suite
+ build in CI before merge, and in most cases also exercised manually
against a live running server with `curl` as a second, independent check.

## Phase 0 — Foundations

The project had no git history at all before this — it lived entirely as
files on a OneDrive-synced desktop. Fixed:

- `git init`, pushed to a private GitHub repo
  ([orbit-hr](https://github.com/ashutoshmaharana1337/orbit-hr)).
- GitHub Actions CI (`.github/workflows/ci.yml`): lint, typecheck, unit
  tests, e2e tests against a real Postgres service container, and build —
  for both `api` and `web` — on every PR and push to `master`.
- Node pinned to 22 LTS (`.nvmrc` + `engines` in both `package.json`s).
- Removed leftover `prisma-composer` skill folders and the stray
  `tsconfig.build.tsbuildinfo`; fixed the e2e spec that still asserted the
  old `Hello World!` route instead of `/api/health`.
- **Not done**: branch protection on `master` (paused — needs an explicit
  decision on required-check names before enabling `enforce_admins`).

### Two CI landmines, for when this project's dependencies next get bumped

1. **`npm ci` failed with a lockfile-sync error that wasn't real drift.**
   The lockfile was generated with npm 11.17.0; the npm bundled with
   Node 22 on GitHub's runner resolves optional peer dependencies
   (`magicast`, `typescript`) into the lock differently, so `npm ci` saw
   a false mismatch. Fixed by pinning `npm install -g npm@11.17.0` as a
   CI step rather than regenerating the lockfile against an npm version
   not available locally to verify against.
2. **`npm ci` never generates the Prisma client.** `api/.npmrc` sets
   `ignore-scripts=true` (a deliberate workaround for this dev machine's
   locked-down Windows Application Control policy — see
   [01-project-setup.md](./01-project-setup.md)) — which also disables
   Prisma's postinstall generator, on every machine, not just this one.
   A `postinstall` script would never fire. Fixed with an explicit
   `npx prisma generate` CI step, and the same instruction added to
   `api/README.md` for anyone cloning fresh.

## Phase 1 — Security and correctness

### Critical: cross-tenant write

`attendance` upsert and `employees` create/update accepted `employeeId` /
`managerId` straight from the request body with no check that the id
belonged to the caller's own tenant — a UUID guessed or leaked from
another tenant could be written to. Fixed by resolving every such id
through a tenant-scoped lookup (`EmployeesService.assertBelongsToTenant`)
before any write.

### High: reads ignored roles entirely

`GET /employees`, `GET /leave`, and `GET /leave/balance/:employeeId` were
guarded by `JwtAuthGuard` only — any authenticated `EMPLOYEE` could read
the whole company's phone numbers and every colleague's leave reason.
Added per-role visibility, enforced in the service layer (not the
controller) so every caller inherits it:

- `EMPLOYEE` — full record for self, a public directory subset (name,
  title, department) for everyone else; own leave requests only.
- `MANAGER` — self + direct reports.
- `HR` / `ADMIN` — the whole tenant.

### High: leave approval was unsafe

`decide()` let any `MANAGER` approve or reject *any* request in the
tenant — including their own — as two separate, non-atomic writes, with
no check against the remaining balance. Now: wrapped in `$transaction`,
requires the approver to be the employee's actual manager (or HR/ADMIN),
rejects self-approval, and rejects an approval that would exceed the
balance.

All three of the above are proven by
`api/test/tenant-isolation.e2e-spec.ts` — registering two real tenants
and asserting the write/read is rejected, not just eyeballed.

### High: session and auth hardening

Shipped as three separate PRs, since each is independently substantial:

| PR | What | Key detail |
|---|---|---|
| [#2](https://github.com/ashutoshmaharana1337/orbit-hr/pull/2) | httpOnly cookies + rotating refresh tokens | 15-minute access token in an httpOnly cookie (never touches JS or a response body); a random, hashed, single-use refresh token scoped to `/api/auth`; replaying an already-rotated-out refresh token revokes *every* active session for that user, not just the one replayed |
| [#3](https://github.com/ashutoshmaharana1337/orbit-hr/pull/3) | Rate limiting + `helmet` | `@nestjs/throttler`, 120 req/min default, 5 req/min on `/auth/login` and `/auth/register`; `@nestjs/throttler`'s latest release only declares peer support up to NestJS 11 (this repo is on 12) — pinned via `package.json` `overrides` rather than `--legacy-peer-deps` project-wide, since it only touches stable, long-unchanged Nest APIs |
| [#4](https://github.com/ashutoshmaharana1337/orbit-hr/pull/4) | Invite flow + password reset | `POST /employees/:id/invite` (ADMIN/HR) creates a `User` for an existing `Employee` with an unusable random password hash — no separate "pending" flag needed, login is naturally blocked until the invite link is used; `forgot-password` / `reset-password` share one consumption endpoint and one `PasswordSetToken` table (`INVITE` \| `RESET`) |

Session storage was previously a JWT in `localStorage` for 24h with no
refresh, no revocation, and no rate limiting on login/register at all —
see [06-auth.md](./06-auth.md#known-seams-by-design-not-bugs) for what
that looked like.

### High: attendance used the server's clock, not the tenant's

`startOfToday()` and the `LATE` cutoff (`hour >= 10`) read the server's
local time — on a UTC container, a Bengaluru employee clocking in at 9 AM
local was recorded as 3:30 AM UTC, and anyone clocking in before 5:30 AM
IST landed on *yesterday's* attendance row.

[PR #5](https://github.com/ashutoshmaharana1337/orbit-hr/pull/5): `Tenant`
gained `timezone` (IANA name) and `lateCutoffMinutes`, both configurable
via `GET`/`PATCH /tenant/settings` (`PATCH` is ADMIN-only). New
`api/src/attendance/business-time.ts` computes the business date and
late/present status against the tenant's zone via `date-fns-tz`, unit-
tested directly against known UTC instants (a DST-observing zone, and an
IST midnight-boundary case). This one had a real "verify before trusting
memory" moment worth knowing about if you touch this code: `date-fns-tz`'s
`toZonedTime()` only produces correct results when read with `Date`'s
*local* getters (`getHours()`, not `getUTCHours()`) — and that trick only
works if the Node process's own timezone is UTC. Confirmed this
empirically with a throwaway script before relying on it, then pinned
`process.env.TZ = 'UTC'` in `main.ts` and both vitest configs so it's true
everywhere the app runs, not just by deployment-environment accident.

### High: Postgres row-level security

Every service already scopes its own queries by `tenantId` (see above) —
but that's an *application-layer* guarantee: it holds only as long as
every query everywhere remembers the filter. This adds the
database-level backstop the review calls for: even a query that forgets
its `tenantId` clause entirely now gets refused by Postgres itself, not
just by careful code review.

This turned out to be the single most architecturally invasive change in
the whole hardening pass — bigger in scope than the cookie/refresh-token
work — for two reasons that only became clear once building it started:

1. **The table owner and any Postgres superuser always bypass RLS**,
   regardless of policies — including `FORCE ROW LEVEL SECURITY`, which
   only affects non-superuser table owners. This isn't a dev-only quirk:
   every managed Postgres provider's default app role has this problem
   too (it's exactly why Supabase's PostgREST layer authenticates as a
   separate `authenticated`/`anon` role, never as `postgres`). Confirmed
   empirically that this dev Postgres's `orbit` role has `rolbypassrls=t`
   before writing a single policy, rather than assuming. Fixed by adding
   a new migration-created role, `orbit_app` — `NOSUPERUSER NOBYPASSRLS`
   — that the app's `DATABASE_URL` now points at, while `prisma migrate`/
   `generate` use a new `DIRECT_DATABASE_URL` (the privileged role) via
   Prisma's `directUrl` datasource field.
2. **Login and registration are inherently cross-tenant lookups** — you
   look up a `User` by email *before* you know their tenant, which is
   incompatible with a naive tenant-scoped policy on `User`. Solved with
   an explicit, narrow `app.bypass_rls` session flag that only the
   handful of routes needing it set (`@BypassTenantRls()`) — and that
   only ever widens *read* visibility on the three tables whose policies
   reference it (`User`, `RefreshToken`, `PasswordSetToken`); every
   write's `WITH CHECK` on the tenant-bearing tables ignores the flag
   entirely, so a write can never land under the wrong tenant no matter
   which routes have it set.

**Mechanism** (`api/src/prisma/`): a global `TenantTransactionInterceptor`
wraps every HTTP request in one Prisma interactive transaction, sets
`app.current_tenant_id` (from the JWT) and `app.bypass_rls` (only where
`@BypassTenantRls()` says so) once per request, and makes that transaction
the active connection for the request's duration via `AsyncLocalStorage` —
so every existing `this.prisma.employee.findMany()`-style call site kept
working with zero changes. The four services that previously wrapped
their own multi-step writes in their own nested `$transaction()` calls
(`register()`, `invite()`, `resetPassword()`, `leave.decide()`) had that
wrapper removed — they're already atomic as part of the one outer
per-request transaction.

**Two bugs found only by actually running it against a live server**,
not by reasoning about the design on paper:

- Postgres enforces a table's `SELECT` policy on an `INSERT ... RETURNING`
  clause too, not just `WITH CHECK` on the write. Prisma's `.create()`
  always uses `RETURNING`. Since a brand-new tenant's id can never already
  equal `app.current_tenant_id` — that's the whole chicken-and-egg problem
  registration has to solve — the first version of `Tenant`'s policy made
  every single registration fail on its own `INSERT`. Fixed in a follow-up
  migration by letting `Tenant`'s read visibility honor `bypass_rls` too
  (`register()` already sets it for the unrelated email/slug-uniqueness
  checks).
- Wrapping the whole request in one transaction means a deliberately
  *thrown* exception (an intentional 401/403/404/409, not a bug) would
  roll back writes made just before it — silently undoing the
  refresh-token-replay defense, which revokes a user's whole session
  family and *then* throws `Unauthorized`. Fixed by having
  `PrismaService.runInTenantContext()` distinguish an `HttpException`
  (commit what came before it, then re-throw after) from a genuinely
  unexpected error (roll back, as intended) — see the comment on that
  method for the reasoning.

New `api/test/row-level-security.e2e-spec.ts` proves the actual point of
this work: an unfiltered `employee.findMany()` under one tenant's context
returns only that tenant's row even with no `WHERE` clause at all, an
update targeting another tenant's row by its exact id is refused, and a
query with no tenant context set returns nothing (fails closed, not
open) — plus the existing e2e suites (tenant isolation, cookies, invite/
reset, timezone) all still pass unmodified against the RLS-enforced
database, confirming the backstop didn't just move the bug, it closed it.

### Not yet done

- Branch protection on `master`.
- Everything in phases 2–6 of the review: wiring `web/` off mock data,
  `Department`/`LeavePolicy`/`AuditLog` tables, a Playwright smoke suite,
  Docker/staging/production infra, and observability (Sentry, structured
  logs, backup rehearsal).

## New environment variables

| Variable | Default | Notes |
|---|---|---|
| `JWT_EXPIRES_IN` | `15m` (was `1d`) | Access-token TTL |
| `WEB_ORIGIN` | `http://localhost:3000` | Locks CORS to one origin; now also drives `credentials: true` cookie exchange |
| `RESEND_API_KEY` | unset | Without it, `MailService` logs invite/reset emails (including the link) instead of sending them — fully functional for dev/demo without a provider account |
| `MAIL_FROM` | `Orbit HR <onboarding@resend.dev>` | Only used once `RESEND_API_KEY` is set |

## Session log

See [CHANGELOG.md](./CHANGELOG.md) for the entry covering this work.
