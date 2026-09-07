# Changelog

Chronological log of work done on Orbit HR so far. Newest first.

## Session 7 — Production hardening

Triggered by a full tech-lead-style review
(`docs/production-readiness-review.html`), verdict "Not yet" — two critical
vulnerabilities, no version control, four screens still on mock data.
Working through the review's phased roadmap; this session covers phases 0
(foundations) and 1 (security/correctness). Full detail in
[07-production-hardening.md](./07-production-hardening.md); summary here.

**Foundations**: `git init`, pushed to a private GitHub repo, a GitHub
Actions CI pipeline (lint/typecheck/unit/e2e-against-real-Postgres/build
for both apps), Node pinned to 22 LTS. Hit and fixed two real CI-only
failures along the way: a false `npm ci` lockfile-sync error from an npm
version mismatch between local and the CI runner, and a missing Prisma
client on fresh install because `ignore-scripts=true` (needed for this
machine's locked-down npm policy) also silently disables Prisma's
postinstall generator everywhere, not just here.

**Fixed, each proven with a real two-tenant e2e test, not just read and
believed**:
- Critical: attendance upsert and employee create/update accepted an
  `employeeId`/`managerId` from the request body with no tenant check —
  a cross-tenant write.
- High: `GET /employees`, `GET /leave`, `GET /leave/balance/:id` ignored
  role entirely past the auth guard — any `EMPLOYEE` could read the whole
  company's phone numbers and leave reasons.
- High: leave approval let a `MANAGER` approve anyone including
  themselves, as two non-atomic writes, with no balance check.

**Shipped as four further PRs**:
- Session moved from a `localStorage` JWT to httpOnly cookies with
  rotating, hashed refresh tokens (replay of a rotated-out token revokes
  every session for that user).
- Rate limiting (`@nestjs/throttler`) and `helmet` security headers.
- An invite flow (`POST /employees/:id/invite`) and password reset,
  sharing one token table and one consumption endpoint; a `MailService`
  that logs the email (link included) when no provider is configured, so
  the whole flow is testable without a real email account.
- Attendance now computes "today" and the late-cutoff in the tenant's own
  timezone (configurable per tenant) instead of the server's — verified
  with unit tests pinning exact library behavior and e2e tests using fake
  system time to prove the midnight-boundary case.

**Then, as its own effort** (bigger in scope than everything above
combined — the review itself sizes it at 2–3 days): Postgres row-level
security as a database-enforced backstop, independent of every
application-layer `tenantId` filter above. Required two things that only
became clear while building it — a restricted, non-superuser Postgres
role (the table owner and any superuser always bypass RLS regardless of
policy, on every provider, not just this dev box) with a second,
privileged connection string reserved for migrations; and a narrow,
explicit "cross-tenant lookup" flag for the few routes (login, register,
refresh, invite) that inherently have to look up a row before any tenant
is known. Found and fixed two bugs that only surfaced against a live
server: Postgres enforces a table's read policy on `INSERT ... RETURNING`
too, which made every registration's own tenant-creation fail outright at
first; and wrapping a whole request in one transaction meant a
deliberately-thrown 401 was silently rolling back the very
refresh-token-replay defense it was supposed to report. New
`row-level-security.e2e-spec.ts` proves the database itself refuses an
unfiltered cross-tenant query, not just that application code remembers
to filter.

**Still open**: branch protection on `master`, and phases 2–6 of the
review (the frontend is still on mock data — see
[06-auth.md](./06-auth.md#known-seams-by-design-not-bugs)).

## Session 6 — Real login + department landing pages (multi-agent)

Requested: a real login page anyone can use, and a separate landing page
per department after login. Explicitly asked to use subagents — split into
3 parallel workstreams with interface contracts fixed up front by the
coordinator (URL scheme `/d/{department.toLowerCase()}`, the exact
`/auth/me` response shape, non-overlapping file ownership) so all three
could run truly in parallel with zero merge conflicts.

- **Backend** (subagent 1): added 5 more seeded logins — one manager-role
  account per remaining department (Engineering, Design, Sales, Marketing,
  Finance), reusing the existing tenant and employee records. All 6 logins
  verified against the live API (login + `/me` department resolution).
- **Auth plumbing** (subagent 2): `apiFetch()` client, `AuthProvider`/
  `useAuth()` (JWT in `localStorage`, rehydrates via `/auth/me`),
  `AuthGuard` protecting the `(app)` route group, the `/login` page itself,
  and wiring the real logged-in identity into the sidebar/header (which
  previously hardcoded "Girija Kuanr" everywhere). Verified with its own
  Playwright pass: logged-out redirect, wrong-password error, correct
  post-login redirect, already-authenticated `/login` bounce, sign-out.
- **Department landing pages** (subagent 3):
  `web/src/app/(app)/d/[department]/page.tsx` — team headcount stats and
  member list per department, statically generated for all 6.

**Coordinator's own integration pass** after all three landed: real
Playwright login as 3 different department users (Engineering, Sales,
Finance) — confirmed each lands on their *own* department page, sees
themselves listed as a team member, the header shows their real name (not
Girija's), navigating onward to `/dashboard` works, sign-out works, zero
console errors across all three. Also re-swept the pre-existing pages
(`/employees`, `/attendance`, `/leave`, `/dashboard`) while authenticated
to confirm nothing broke. Full production build passes with `/login` and
all 6 `/d/*` static paths present in the route output.

See [06-auth.md](./06-auth.md) for the full architecture and the seams
this leaves for next time (most of the app still runs on mock data — only
auth is wired to the real backend).

## Session 5 — Keka-inspired re-skin

Requested reference: keka.com. Since `WebFetch` failed on SSL cert
verification in this environment, the page was pulled with `curl` and its
**actual design tokens extracted from the stylesheet** rather than guessed:
brand `#7c46f1`, body font Nunito Sans, surface tint `#f8f9fc`, lavender
tints `#f2f0fa`/`#f5f0ff`, 8–16px radii, weights 400/500/600.

- **Brand → purple.** `--primary` and the whole sidebar/active/focus chain
  moved to `#7c46f1` (light) / `#9c7bf5` (dark).
- **Font → Nunito Sans**, Keka's real body font (their heading font,
  `tt-commons-pro`, is paid Adobe, so Nunito Sans carries both roles).
- **Surfaces.** Page plane is now tinted `#f8f9fc` with white cards and a
  white header, so content lifts off the background instead of everything
  being flat white. Radius bumped `0.625rem` → `0.875rem`; card ring
  softened and given a faint shadow.
- **Chart slot 1 → purple, validated not eyeballed.** Ran the dataviz
  palette validator on the new pairing: purple↔orange separates at ΔE 31.7
  under CVD simulation (floor 8) and 35.8 normal-vision (floor 15) — all
  gates pass on both light and dark surfaces.
- **Avatar palette** reordered to lead with violet so people-colors sit in
  the brand family.
- **Fixed a real bug spotted in the screenshots**: the department filter
  rendered a raw `all` instead of "All departments". Base UI's
  `Select.Value` renders the raw value by default (Radix renders the
  selected item's label) — fixed with the documented `children`-as-function
  form.

Verified: production build passes, zero console errors across all routes,
and every screen reviewed in screenshots.

Note: this is visual inspiration only — no Keka branding, naming, or assets
were copied; the product remains "Orbit HR".

## Session 4 — Backend: NestJS + Postgres + Prisma

Scaffolded `api/` alongside `web/`, decided by request: NestJS, same repo,
and "as much of the planned backend as makes sense" — built auth + Core HR
+ Attendance + Leave in one pass rather than staging it.

**Environment setup:**
- Hit the same global npm `allow-scripts` restriction as the frontend;
  same `.npmrc` fix (`api/.npmrc`).
- `npm install prisma` pulled a `8.0.0-rc` release that turned out to be an
  entirely different product — **Prisma Composer**, a cloud-deploy service
  mesh framework, not the classic local ORM. Pinned `prisma` and
  `@prisma/client` to `6.19.3` instead. Full detail in
  [05-backend.md](./05-backend.md#prismas-cli-was-mid-rewrite--pin-to-6x-not-whatever-npm-install-prisma-gives-you)
  — worth reading before ever bumping this dependency.
- Postgres via Docker Compose (`docker-compose.yml`, repo root); Docker
  Desktop wasn't running and had to be launched first.

**Built:**
- Prisma schema: `Tenant`, `User`, `Employee`, `AttendanceRecord`,
  `LeaveRequest`, `LeaveBalance` — tenant-scoped throughout.
- `auth` module: register (creates tenant + admin user + employee in one
  transaction), login, `/me`, JWT strategy, `JwtAuthGuard` + `RolesGuard` +
  `@Roles()`.
- `employees`, `attendance`, `leave` modules — full CRUD/business-logic
  coverage matching what the frontend's mock data models (search/filter,
  clock-in/out, leave approve/reject with automatic balance increments).
- A seed script (`api/prisma/seed.ts`) mirroring the frontend's mock data
  (same 15 people, same departments) so the two stay comparable — login
  `girija.kuanr@acme.dev` / `password123`.

**Bugs fixed during setup** (full detail in
[05-backend.md](./05-backend.md#gotchas-hit-during-setup)):
1. A JWT type mismatch (`expiresIn` expects a template-literal type, not a
   generic `string`) — build-time only, fixed with a type assertion.
2. `JwtAuthGuard` failed to resolve (`UnknownDependenciesException`) in
   every feature module — `PassportModule` needs `.register()` called
   before it provides anything; bare `imports: [PassportModule]` is a
   no-op.
3. Mid-build, tightened `User.email` from a per-tenant-unique to a
   globally-unique constraint (login resolves by email alone, so the
   original per-tenant constraint left a real race-condition gap). Prisma
   correctly **refused** `migrate reset` here — it detects AI-agent
   invocation and hard-blocks destructive commands without explicit user
   consent. Solved by hand-authoring the migration SQL and applying it
   with `migrate deploy` instead, preserving all existing data.

**Verified end-to-end** (real HTTP requests against the running API, not
unit tests): register → login → `/me` → tenant isolation (a second
registered tenant genuinely sees zero of the first tenant's 15 employees)
→ employee create/patch → leave list/approve → leave balance increments on
approval → re-approving an already-decided request correctly 400s →
clock-in conflict correctly 409s on a second attempt → unauthenticated
requests correctly 401.

## Session 3 — Typography & font fix

- Discovered `--font-sans: var(--font-sans)` in `globals.css` was
  self-referential — the Geist font loaded in `layout.tsx` was never
  actually wired up, so the app had been rendering in the OS default UI
  font the whole time.
- Switched the sans font to **Inter**, fixed the CSS variable wiring so it
  actually applies.
- Increased the heading scale across the app: card titles, page headers,
  stat-card hero numbers, and the employee profile name all sized up (see
  [03-design-system.md](./03-design-system.md#typography) for the exact
  before/after sizes).

## Session 2 — "Linear/Notion feel, but more color"

Design direction requested: Linear/Notion's typography and spacing
precision, blended with bolder, non-gray color for identity (not just blue
for every accent).

- Added an extended 8-color categorical palette (`--cat-1`…`--cat-8`) on
  top of the existing 5-color chart palette.
- New `src/lib/colors.ts`: fixed department/leave-type → color mappings,
  plus a separate hashed, contrast-safe palette for avatar fills.
- New shared components: `<Tag>` (colored identity pill) and
  `<PersonAvatar>` (solid-color avatar, hashed per person).
- Swapped every plain gray `Avatar`/`AvatarFallback` usage across the app
  for `<PersonAvatar>`; department and leave-type plain text became
  `<Tag>`.
- Dashboard stat cards got colored icon chips (was: uniform gray).
- Sidebar active nav item redesigned: tinted primary background + left
  accent bar, replacing the shadcn-default flat gray highlight (hand-edited
  `components/ui/sidebar.tsx`).
- Card titles bumped to `font-semibold tracking-tight`.
- Verified via a fresh Playwright interaction pass (approve/reject leave,
  open the request dialog, open the user dropdown, filter by department) —
  zero console errors, build clean.

## Session 1 — Initial build

**Brainstorm.** Discussed 2026-era HR SaaS architecture: modular monolith
to start, Postgres with row-level multi-tenancy, WorkOS/Clerk for
SSO/SCIM, payroll flagged as highest-compliance-risk module (recommended as
a fast-follow, not v1). Decided v1 scope: full core set (Core HR,
recruitment/ATS-adjacent, attendance, leave), multi-tenant SaaS target, no
hosting constraint.

**Scaffolding.**
- `create-next-app` (Next.js 16, TypeScript, Tailwind v4, App Router,
  Turbopack flag — later overridden, see below).
- Hit a global npm `allow-scripts` policy blocking all installs; added
  project-local `.npmrc` to override it (see
  [01-project-setup.md](./01-project-setup.md)).
- shadcn/ui `init` failed silently on first attempt (wrote config, never
  installed deps/theme) because of the same npm restriction; re-ran after
  the `.npmrc` fix.
- Discovered Turbopack's native binary is blocked by a Windows Application
  Control policy on this machine; switched `dev`/`build` scripts to
  `--webpack`.

**Built the four core screens**, all on mock data
(`src/lib/mock-data.ts` — 15 employees, attendance records, leave requests,
dashboard stats):
- **Dashboard**: stat cards, attendance trend chart, department headcount
  chart, recent activity feed, pending leave list. Charts built following
  the `dataviz` skill (validated categorical palette, proper mark specs,
  legends, tooltips).
- **Employees**: searchable/filterable directory table; profile page with
  tabs (overview, attendance, leave history), leave balance bars, direct
  reports.
- **Attendance**: today's status summary + searchable table.
- **Leave**: filterable request table with working approve/reject
  (client-side state) and a "Request leave" dialog.

**Bug fixes** (all found via real browser interaction testing, not just
build/visual checks) — see
[04-bugs-and-fixes.md](./04-bugs-and-fixes.md) for full detail:
1. `Button` rendered as a `Link` via `render` prop — disallowed by Base
   UI's button semantics; switched to `buttonVariants()` on the `Link`
   directly.
2. Dropdown user menu crashed on open — `DropdownMenuLabel` needs a
   `DropdownMenuGroup` wrapper in Base UI (unlike Radix).
3. Attendance trend chart's first X-axis label was clipped by a stray
   negative chart margin.

**Verification**: production build (`next build --webpack`) passing,
TypeScript clean, and a scripted Playwright pass across all 5 routes
(dashboard, employees, employee profile, attendance, leave) confirming no
console errors and visually reviewing every screenshot.
