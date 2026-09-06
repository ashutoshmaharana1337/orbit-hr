# Authentication & Department Landing Pages

The frontend now has real authentication wired to the backend — this is
the first piece of `web/` that talks to `api/` instead of mock data
(everything else — Employees, Attendance, Leave content — is still mock,
see [02-frontend-architecture.md](./02-frontend-architecture.md)).

## Flow

1. Visiting any page under the `(app)` route group while logged out
   bounces to `/login` (via `AuthGuard`, see below).
2. `/login` — email + password, calls the real backend, stores the JWT.
3. On success, the user is redirected to `/d/{department}` — a landing
   page scoped to their own department (Engineering, Design, Sales,
   Marketing, People, or Finance), not the generic dashboard.
4. From there they can navigate into the rest of the app (Dashboard,
   Employees, Attendance, Leave) via the normal sidebar, same as before.

## Pieces

| File | Role |
|---|---|
| `web/.env.local` | `NEXT_PUBLIC_API_URL=http://localhost:3001/api` |
| `web/src/lib/api-client.ts` | `apiFetch()` — thin fetch wrapper, attaches the bearer token, throws `ApiError` with the backend's parsed `{message}` on failure |
| `web/src/lib/auth-context.tsx` | `AuthProvider` / `useAuth()` — holds `{token, user, employee, loading}`; persists the JWT in `localStorage` (`orbit_token`); rehydrates via `GET /auth/me` on mount; `login()` returns the fetched employee so the caller can redirect by department without a second round trip |
| `web/src/components/auth-guard.tsx` | Client wrapper used in `(app)/layout.tsx` — shows a brief loading state, then either redirects to `/login` or renders `children` |
| `web/src/app/login/page.tsx` | The sign-in screen — outside the `(app)` group (no sidebar), reuses existing `Card`/`Input`/`Button` |
| `web/src/app/(app)/d/[department]/page.tsx` | Department landing — team headcount stats + member list, `generateStaticParams()` over the 6 known departments |

`AuthProvider` wraps the whole app from the root layout (`app/layout.tsx`)
so `/login` itself can call `useAuth()`. `AuthGuard` only wraps the
`(app)` route group, so `/login` is reachable while logged out.

## Logins (seeded, password `password123` for all)

| Email | Department | Role |
|---|---|---|
| girija.kuanr@acme.dev | People | ADMIN |
| ananya.rao@acme.dev | Engineering | MANAGER |
| sarah.johnson@acme.dev | Design | MANAGER |
| emma.novak@acme.dev | Sales | MANAGER |
| marcus.lee@acme.dev | Marketing | MANAGER |
| nadia.petrova@acme.dev | Finance | MANAGER |

Added in `api/prisma/seed.ts` (idempotent — safe to rerun via
`npm run prisma:seed` from `api/`).

## Known seams (by design, not bugs)

- **Sidebar/header identity is real; Employees/Attendance/Leave content is
  still mock.** Log in as Ananya Rao and the header correctly shows "Ananya
  Rao" / "VP of Engineering" — but the Employees table still lists the same
  15 mock employees regardless of who's logged in, and Leave
  approve/reject still mutates a local `useState` copy, not the real
  backend. Only the department landing page (`/d/[department]`) reads from
  the same mock data, filtered — it's not reading the real backend's
  employee list either. Connecting the rest of the app to the real API is
  the next natural step (already flagged in
  [05-backend.md](./05-backend.md#whats-not-done-yet)).
- **"My profile" links now point to the user's own department page**
  (`/d/{department}`), not a specific employee ID — the old hardcoded link
  to a mock employee ID (`/employees/e-1012`) would have been wrong for
  every user except Girija.
- **Token storage is `localStorage`**, fine for this stage but not
  hardened (no httpOnly cookie, no refresh-token rotation) — acceptable
  for a portfolio/demo project, worth revisiting before anything resembling
  production use.

## How this was built

Three subagents in parallel, after the coordinating session fixed the
interface contracts up front (URL scheme `/d/{department.toLowerCase()}`,
the exact `/auth/me` response shape, which files each agent owned) so
there were zero merge conflicts:
1. Backend — added 5 more seeded logins (one per remaining department).
2. Frontend auth plumbing — login page, auth context, route guard, wired
   real identity into the existing sidebar/header.
3. Frontend department landing pages.

All three were verified independently by their own agent, then verified
again end-to-end by the coordinator afterward (full login → land on
correct department page → see real name in header → navigate to dashboard
→ sign out, for 3 different department users) plus a full production
build. See [CHANGELOG.md](./CHANGELOG.md) for the session log.
