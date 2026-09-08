# Wiring the frontend to live data

Phase 2 of `docs/production-readiness-review.html`'s roadmap: replace
`web/`'s mock data (`src/lib/mock-data.ts`) with the real API, one screen at
a time, in the order the review recommends — Employees, Attendance, Leave,
Dashboard. This doc tracks that phase as it lands; each screen is its own
PR, verified against a live API + Postgres, not just typechecked.

## Foundations (land once, reused by every later screen)

- **TanStack Query** (`@tanstack/react-query`) — `web/src/lib/query-client.tsx`
  wraps the app in a `QueryClientProvider`; `retry` is disabled for 4xx
  (`ApiError.status < 500`) since those mean "wrong request," not
  "transient," and retrying would just repeat the same rejection.
- **No shared-types package yet.** The review suggests either generating
  typed clients from the API's DTOs or a `packages/contracts` module — this
  repo has no npm workspace at all (see
  [07-production-hardening.md](./07-production-hardening.md)), and setting
  one up is a bigger structural change than one screen's worth of wiring
  justifies right now. Instead, `web/src/lib/api/types.ts` hand-mirrors the
  API's response and DTO shapes, the same pattern `auth-context.tsx` already
  used for `/auth/me`. `auth-context.tsx` now imports `Role`/`EmployeeStatus`
  from that file instead of keeping its own copy, so there's exactly one
  definition of each, not two that can drift. Revisit a real shared package
  once enough screens are wired that the duplication actually hurts.
- **Per-resource pattern**: `web/src/lib/api/<resource>.ts` (plain
  `apiFetch` calls) + `web/src/hooks/use-<resource>.ts` (TanStack Query
  hooks: `use<X>`, `use<X>s`, `useCreate<X>`, `useUpdate<X>`, invalidating
  the right query keys on mutation success). `employees.ts` /
  `use-employees.ts` are the first instance — later screens follow the same
  shape.

## Employees screen (first increment)

- `employee-directory.tsx` — list now comes from `GET /employees` via
  `useEmployees({ search, department })`, search/department filtering moved
  server-side (was an in-memory `.filter()` over the whole mock array).
- `employees/[id]/page.tsx` — was an `async` **Server Component** with
  `generateStaticParams()` statically generating one page per mock employee
  id at build time. Real employee data is tenant-scoped and
  auth-cookie-gated, so it can't be resolved at build time or via a plain
  server-side `fetch` without adding cookie-forwarding plumbing (`cookies()`
  from `next/headers`) that doesn't exist anywhere else in this app yet.
  Converted to a Client Component using `useParams()` + `useEmployee(id)`
  instead — consistent with how `AuthGuard`/`auth-context` already resolve
  the session client-side by asking `/auth/me`, and with Next's own
  guidance that community query libraries are the client-side answer here
  (see `node_modules/next/dist/docs/01-app/01-getting-started/06-fetching-data.md`).
  This also correctly drops the route from static generation
  (`ƒ Dynamic` in the build output, not `● SSG`).
- **"Add employee" / "Edit"** are real now (`employee-form-dialog.tsx`,
  shared between both entry points): `POST`/`PATCH /employees`, gated to
  `ADMIN`/`HR` in the UI (the API enforces this regardless — the UI gate is
  just to not show a form that would 403). The manager picker is a live
  `useEmployees()` list, self excluded in edit mode.
- **Role-shaped responses, handled honestly, not padded with fake data.**
  `GET /employees` and `GET /employees/:id` return different subsets of
  fields depending on the caller's role (see
  [07-production-hardening.md](./07-production-hardening.md#high-reads-ignored-roles-entirely)) —
  `EmployeeSummary`/`EmployeeDetail` in `api/types.ts` mark those fields
  optional rather than assuming they're always present, and the detail
  page only renders the "Leave balance" / "Direct reports" cards when the
  API actually returned them.
- **Attendance and leave history tabs on the detail page are placeholders**
  (`"isn't wired to the real API yet"`), not mock data. The old version showed
  fabricated attendance/leave rows keyed to the mock employee id; carrying
  that forward against a *real* employee identity would show false records
  under a real person's name, which is worse than an honest "not built yet"
  state. These fill in when Attendance and Leave get their own passes.
- `initials()` moved from `mock-data.ts` to `lib/utils.ts` — it's a pure
  string helper with no mock-data dependency, and `site-header.tsx` /
  `app-sidebar.tsx` were already importing it to format a *real*
  `AuthEmployee`'s name, not a mock one.

### Verified

- `lint`, `typecheck`, `build` all pass (webpack production build — the
  same commands CI runs).
- Live-server pass: seeded a tenant (`npm run prisma:seed` in `api/`),
  logged in as the seeded ADMIN via `curl` and compared every response
  (`GET /employees`, `GET /employees/:id`, `POST /employees`,
  `PATCH /employees/:id`) against the frontend's types field-for-field.
- Browser pass (Playwright against system Chrome, headless — this dev
  machine has no network access to download Playwright's own Chromium, so
  it launched the locally installed Chrome via `executablePath` instead):
  logged in as the seeded ADMIN, opened the Employees list, created an
  employee through the "Add employee" dialog, confirmed it appeared in the
  list, opened its detail page, edited it through the "Edit" dialog, and
  confirmed the change round-tripped to the detail page. Zero console
  errors other than the expected pre-login `401` on the `/auth/me` probe
  (the same one `login/page.tsx` already tolerates).

### Not yet done

- Attendance, Leave, and Dashboard screens — still on `mock-data.ts`.
- The two dashboard aggregate endpoints (`GET /dashboard/stats`,
  `GET /attendance/trend?days=7`) the review calls for — not built yet,
  land with the Dashboard screen.
- The department landing page (`d/[department]/page.tsx`) still renders
  from mock `employees`/`departments` — only its `initials` import was
  repointed (mechanical fix, `mock-data.ts` no longer exports it).
- Deleting `mock-data.ts` — the review's own milestone for "done," and it
  still backs three screens.
