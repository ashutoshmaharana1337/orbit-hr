# Frontend Architecture

## Folder structure

```
web/src/
├── app/
│   ├── layout.tsx              Root layout — fonts, <html>/<body>, metadata
│   ├── page.tsx                "/" → redirects to /dashboard
│   ├── globals.css             Theme tokens (colors, radius), Tailwind imports
│   └── (app)/                  Route group: everything behind the sidebar shell
│       ├── layout.tsx          Wraps children in SidebarProvider + AppSidebar
│       ├── dashboard/
│       │   ├── page.tsx
│       │   ├── attendance-trend-chart.tsx   (client component, recharts)
│       │   └── department-chart.tsx         (client component, recharts)
│       ├── employees/
│       │   ├── page.tsx
│       │   ├── employee-directory.tsx       (client — search/filter table)
│       │   └── [id]/page.tsx                (dynamic — employee profile)
│       ├── attendance/
│       │   ├── page.tsx
│       │   └── attendance-table.tsx         (client — search table)
│       └── leave/
│           ├── page.tsx
│           └── leave-board.tsx              (client — filter tabs, approve/reject, request dialog)
├── components/
│   ├── layout/
│   │   ├── app-sidebar.tsx     Left nav (Dashboard/Employees/Attendance/Leave)
│   │   └── site-header.tsx     Top bar — breadcrumb title, search, notifications, user menu
│   ├── person-avatar.tsx       Deterministic per-person colored avatar (see design-system doc)
│   ├── status-indicator.tsx    Dot + label for attendance/leave/employee status
│   ├── tag.tsx                 Colored pill for department/leave-type
│   └── ui/                     shadcn-generated primitives (Button, Card, Table, Dialog, ...) — do not hand-edit lightly, see note below
├── lib/
│   ├── mock-data.ts            All in-memory data: employees, attendance, leave requests, dashboard stats
│   ├── status.ts                Status → {color, label} maps (employee/attendance/leave)
│   ├── colors.ts                Department/leave-type/avatar color assignment
│   └── utils.ts                 `cn()` helper (shadcn standard)
└── hooks/
    └── use-mobile.ts            shadcn standard — sidebar responsive breakpoint
```

## Routing

Next.js App Router, file-based. The `(app)` folder is a **route group** — it
doesn't appear in the URL, it just lets `/dashboard`, `/employees`,
`/attendance`, `/leave` all share the sidebar layout without repeating it.

`/employees/[id]` is a dynamic route with `generateStaticParams()` so all 15
mock employee profiles are statically generated at build time.

## Data flow (current — no backend)

Everything reads directly from `src/lib/mock-data.ts`, which exports plain
arrays/objects (`employees`, `todayAttendance`, `leaveRequests`,
`attendanceTrend`, `headcountByDepartment`, `dashboardStats`,
`recentActivity`, `leaveBalances`) plus lookup helpers (`getEmployee`,
`getLeaveBalance`, `initials`).

Pages that need interactivity (search, filters, the leave approve/reject
buttons) are Client Components (`"use client"`) that copy the mock array
into `useState` and mutate the local copy — nothing persists across a page
reload. This is intentionally the seam where backend data-fetching will
plug in later (see below).

## Planned backend shape

*(from the original architecture discussion — not yet built, captured here
so the plan isn't lost)*

- **Modular monolith** to start (Node/NestJS or Go), split into
  domain modules (Core HR, Attendance, Leave, later Recruitment/Payroll)
  that could become services later without a rewrite.
- **PostgreSQL** as system of record, row-level multi-tenancy
  (`tenant_id` + Postgres RLS) rather than schema-per-tenant.
- **Auth**: WorkOS or Clerk for org-level SSO/SCIM — expected to matter
  even for early enterprise deals.
- **Payroll** flagged as highest-risk module (compliance, tax jurisdiction
  variance) — recommended as a fast-follow rather than in the first backend
  milestone.

None of this is committed yet — it's the starting proposal from the
brainstorm session, to be revisited when backend work actually starts.

## A note on `components/ui/`

These are shadcn-generated files, but they're **not** vendor code to leave
untouched — `card.tsx` and `sidebar.tsx` have already been hand-edited for
the design system (see [03-design-system.md](./03-design-system.md)). Treat
everything in `src/` as this project's own code.
