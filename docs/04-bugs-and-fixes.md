# Bugs Found & Fixed

This project uses **Base UI** (`@base-ui/react`), not Radix — that's the
shadcn CLI's current default, and it has a different API in a few places
that caused real bugs. All of these were caught by actually driving the app
in a headless browser (Playwright) and reading console errors, not by
visual review alone. Worth reading before writing more UI code here.

## 1. Base UI uses `render`, not `asChild`

Radix's polymorphism pattern (`<Comp asChild><a href="...">` ) does not
exist in Base UI. Instead:

```tsx
// Radix (does NOT work here)
<Button asChild>
  <Link href="/foo">Go</Link>
</Button>

// Base UI (correct)
<Button render={<Link href="/foo" />}>
  Go
</Button>
```

The `render` element takes no children of its own — the component's own
`children` prop gets merged into whatever `render` renders.
`SidebarMenuButton`, `DropdownMenuTrigger`, `DropdownMenuItem`,
`DialogTrigger`, `DialogClose` all use this pattern in this codebase.

## 2. Base UI's `Button` primitive refuses to render as a link

Rendering `<Button render={<Link .../>}>` throws (well — logs, doesn't
crash, but is explicitly disallowed):

```
Base UI: A component that acts as a button expected a native <button>
because the `nativeButton` prop is true. ... Use a real <button> in the
`render` prop, or set `nativeButton` to `false`.
```

This was hit on the dashboard's "View all" link. **Fix**: don't route a
link through the `Button` component at all — apply `buttonVariants()` as a
className directly to the `Link`:

```tsx
import { buttonVariants } from "@/components/ui/button"

<Link href="/leave" className={buttonVariants({ variant: "ghost", size: "sm" })}>
  View all
</Link>
```

Note this is specific to the `Button` component (which wraps Base UI's
`Button` primitive and enforces button semantics). `SidebarMenuButton` is
built on a raw `useRender` call, not the `Button` primitive, so it does
**not** have this restriction — `SidebarMenuButton render={<Link />}` is
fine and used throughout the sidebar nav.

## 3. `DropdownMenuLabel` requires a `DropdownMenuGroup` wrapper

Radix lets you drop a `DropdownMenuLabel` directly inside
`DropdownMenuContent`. Base UI's underlying `Menu.GroupLabel` throws at
runtime if it's not inside a `Menu.Group`:

```
Base UI: MenuGroupContext is missing. Menu group parts must be used
within <Menu.Group> or <Menu.RadioGroup>.
```

This only surfaces when the menu is actually **opened** — it won't show up
in a build or a static page load, only in an interaction test. Fix:

```tsx
<DropdownMenuContent>
  <DropdownMenuGroup>
    <DropdownMenuLabel>...</DropdownMenuLabel>
  </DropdownMenuGroup>
  <DropdownMenuSeparator />
  ...
</DropdownMenuContent>
```

**Takeaway**: static rendering + a build passing is not enough to trust a
Base UI menu/dialog/popover — click it open at least once.

## 4. Recharts negative chart margin clips the first axis label

`attendance-trend-chart.tsx` originally used `margin={{ left: -16, ... }}`
to reduce whitespace next to the Y-axis. This clipped the first X-axis tick
label (`Aug 24`) off the left edge of the chart card — not a crash, just a
silently missing label, only visible on actual visual review. Fixed by
setting `margin.left: 0` and letting the explicit `YAxis width={28}`
control the gutter instead.

## 5. A non-issue worth knowing about: sporadic hydration warning on `<Input>`

Occasionally (not reproducibly — moves between routes across runs) React
logs a hydration mismatch pointing at `style={{caret-color:"transparent"}}`
on the header search `<Input>`. Investigated at length:
- No `caret-color` logic exists anywhere in this codebase or in
  `@base-ui/react`'s source.
- It doesn't reproduce consistently on the same route across repeated runs
  of the same unmodified component.

Conclusion: this is headless-Chromium/Playwright autofill-heuristic noise,
not an app bug. If you see it in real browser dev tools and it's
consistent (same route, every time), that would be new information worth
re-investigating — but as observed so far, don't chase it.

## Testing approach used

For every page/interaction change: start the dev server, drive it with a
throwaway Playwright script (`chromium.launch()` → `page.goto()` →
`page.on('console', ...)` to catch errors → screenshot), not just `npm run
build`. Bugs #2 and #3 above only show up on actual interaction (opening a
menu, clicking a link) — a clean build and a static screenshot both missed
them.
