# Backend

NestJS 12 API (`api/`) backed by PostgreSQL via Prisma, running alongside
the frontend in the same repo (`api/` sibling to `web/`).

## Stack

| Layer | Choice |
|---|---|
| Framework | NestJS 12 (ESM — see gotcha below) |
| Database | PostgreSQL 16, via Docker Compose (`docker-compose.yml` at repo root) |
| ORM | Prisma **6.19.3**, pinned deliberately — see gotcha below |
| Auth | Passport JWT strategy, bcrypt password hashing |
| Validation | `class-validator` / `class-transformer`, global `ValidationPipe` |

## Running it

```bash
# from the repo root
docker compose up -d          # starts Postgres on localhost:5432

cd api
npm install
npx prisma migrate deploy     # apply migrations (non-interactive, safe)
npm run prisma:seed           # populate demo data
npm run start                 # http://localhost:3001/api
```

Seeded login: **girija.kuanr@acme.dev / password123** (tenant "Acme Inc.",
role ADMIN, 15 employees, today's attendance, 6 leave requests).

## Architecture

Multi-tenant from the ground up, enforced at two independent layers (see
[07-production-hardening.md](./07-production-hardening.md) for the full
story on the second one):

- Every domain table (`Employee`, `AttendanceRecord`, `LeaveRequest`) carries
  a `tenantId`. Every query in every service is scoped by
  `tenantId` pulled from the authenticated JWT payload — never trusted from
  the request body/params.
- `CurrentUser()` param decorator (`src/auth/decorators/current-user.decorator.ts`)
  extracts `{ sub, tenantId, email, role }` from the validated JWT.
- `JwtAuthGuard` + `RolesGuard` are applied per-controller
  (`@UseGuards(JwtAuthGuard, RolesGuard)`), with `@Roles('ADMIN', 'HR')` etc.
  gating individual routes.
- Postgres row-level security backs all of the above: a global
  `TenantTransactionInterceptor` sets a per-request session variable every
  RLS policy checks, so even a query that forgot its `tenantId` filter
  gets refused by the database itself, not just by application code. The
  app connects as a restricted role with no `BYPASSRLS`, not the
  migration role — see `api/src/prisma/`.

### Modules

| Module | Routes | Notes |
|---|---|---|
| `auth` | `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `POST /auth/forgot-password`, `POST /auth/reset-password`, `GET /auth/me` | Register creates a **Tenant + ADMIN User + Employee** in one transaction (company sign-up); individual logins for existing employees come from `employees.invite` below, not this module. Session is an httpOnly-cookie access token + rotating refresh token — see [07-production-hardening.md](./07-production-hardening.md) |
| `employees` | `GET /employees`, `GET /employees/:id`, `POST /employees` (ADMIN/HR), `PATCH /employees/:id` (ADMIN/HR), `POST /employees/:id/invite` (ADMIN/HR) | List supports `?search=&department=&status=`; reads are role-scoped (self/reports/tenant depending on role) |
| `attendance` | `GET /attendance/today`, `GET /attendance/summary`, `POST /attendance/clock-in`, `PATCH /attendance/clock-out`, `POST /attendance` (ADMIN/HR/MANAGER, direct upsert) | Clock-in resolves the caller's own `Employee` row via their `userId`; one record per employee per day (`@@unique([employeeId, date])`); "today" and the late cutoff are computed in the tenant's own timezone, not the server's |
| `leave` | `GET /leave`, `GET /leave/balance/:employeeId`, `POST /leave`, `PATCH /leave/:id/approve` (ADMIN/HR/MANAGER), `PATCH /leave/:id/reject` (ADMIN/HR/MANAGER) | Approving an `ANNUAL` or `SICK` request increments the matching `LeaveBalance` field; re-deciding an already-decided request is a 400; a manager can only decide their own reports' requests and never their own |
| `tenant` | `GET /tenant/settings`, `PATCH /tenant/settings` (ADMIN) | Timezone and attendance late-cutoff, per tenant |

All verified end-to-end against the running API (not just unit-level) —
register → login → CRUD → tenant isolation (a second tenant genuinely can't
see the first's data) → leave approve/balance-increment →
duplicate-decision rejection → clock-in conflict handling. See the
changelog for the specific test transcript.

## Data model

See `api/prisma/schema.prisma` for the source of truth. Core models:
`Tenant` (now also holding `timezone`/`lateCutoffMinutes`), `User` (login
identity), `Employee` (HR profile — a `User` and an `Employee` are separate
concerns; a `User` optionally links to one `Employee` via `userId`),
`AttendanceRecord`, `LeaveRequest`, `LeaveBalance`, plus `RefreshToken` and
`PasswordSetToken` added for session/invite/reset handling (see
[07-production-hardening.md](./07-production-hardening.md)).

## Gotchas hit during setup

### Prisma's CLI was mid-rewrite — pin to 6.x, not whatever `npm install prisma` gives you

`npm install prisma` on this date pulled `8.0.0-rc.12` — not the classic
Prisma ORM CLI, but **Prisma Composer**, a completely different product: a
cloud-native service-mesh framework (`compute()`, typed RPC contracts,
`prisma-composer deploy` to Prisma Cloud, `contract.prisma` instead of
`schema.prisma`, no `prisma migrate dev` at all). It even auto-installs an
agent-instructions skill (`prisma skills sync` → `.claude/skills/prisma-composer/`)
because it expects an AI agent to need onboarding to its new mental model.

None of that is what a plain "Postgres + ORM inside an existing NestJS app"
setup needs, and `prisma-composer dev` doesn't even support Windows yet.
**Fix**: pinned `prisma` and `@prisma/client` to `6.19.3` — the last stable
line with the classic `schema.prisma` / `prisma migrate dev` /
`prisma generate` workflow this project actually uses.

If you ever bump Prisma versions here, check `npx prisma --version` first —
if you see "Prisma Developer Platform" branding or commands like `contract`,
`branch`, `bucket`, you've picked up Composer again, not the ORM.

### Prisma refuses destructive commands from an AI agent — correctly

`prisma migrate reset` (and similar) detects when it's invoked by an AI
coding agent and hard-refuses without the user's literal, explicit consent
piped through an env var — it will not run "because the agent decided it's
fine." This is a deliberate safety feature and it worked as intended here:
a mid-development schema fix (making `User.email` globally unique instead
of per-tenant) initially reached for `migrate reset`, got refused, and
was solved instead by hand-authoring the migration SQL
(`prisma/migrations/<timestamp>_unique_user_email/migration.sql`) and
applying it with `prisma migrate deploy` — which is non-destructive and
safe to run non-interactively. No data was lost. Reach for this pattern
(hand-write the SQL, `migrate deploy`) over `migrate reset` whenever a dev
database has data worth keeping.

### ESM + NodeNext imports

The NestJS 12 scaffold used here is ESM (`"type": "module"` in
`package.json`, `module`/`moduleResolution: nodenext` in `tsconfig.json`).
Every relative import needs an explicit `.js` extension even though the
source is `.ts` — `import { Foo } from './foo.js'`, not `'./foo'`. This is
already consistent across every file in `src/`; keep it that way.

### `PassportModule` needs `.register()` to do anything

`imports: [PassportModule]` (bare, unconfigured) provides nothing — no
`AuthModuleOptions`, so any guard extending `AuthGuard('jwt')` fails to
resolve with `UnknownDependenciesException` the moment it's used outside
`AuthModule` itself. Needed `PassportModule.register({ defaultStrategy: 'jwt' })`
in `auth.module.ts`, then export both `PassportModule` and `JwtModule` from
`AuthModule`, and import `AuthModule` into every feature module
(`employees`, `attendance`, `leave`) that uses `JwtAuthGuard`.

## What's not done yet

Superseded by [07-production-hardening.md](./07-production-hardening.md),
which covers everything below except the frontend gap:

- ~~No employee-invite flow~~ — fixed, see
  [07-production-hardening.md](./07-production-hardening.md#phase-1--security-and-correctness).
  `POST /employees/:id/invite` (ADMIN/HR) creates a login for an existing
  `Employee`.
- ~~Postgres RLS not implemented~~ — fixed, see
  [07-production-hardening.md](./07-production-hardening.md#high-postgres-row-level-security).
- **Frontend still runs entirely on mock data.** `web/` has not been wired
  to call this API yet — that's the natural next step (auth pages, token
  storage, replacing `src/lib/mock-data.ts` reads with fetches).
- ~~No automated tests~~ — fixed. A real e2e suite now runs against
  Postgres in CI (tenant isolation, role visibility, cookie/refresh/logout,
  invite/reset, timezone boundaries) plus unit tests for the timezone math;
  see [07-production-hardening.md](./07-production-hardening.md).
