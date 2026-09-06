# Design System

The visual direction is a **Keka-inspired purple SaaS aesthetic** (the user
supplied keka.com as the reference): a vibrant purple brand, friendly
rounded typography, lavender-tinted page surfaces with white cards lifting
off them, and generous corner radii. Underneath it keeps the earlier
Linear/Notion structural discipline — tight tracking, semibold headings,
restrained chrome — and **deliberate, non-gray color** for identity (people,
departments, leave types).

Design tokens were taken from keka.com's own stylesheet rather than
eyeballed (brand `#7c46f1`, Nunito Sans, `#f8f9fc` surface tint). Note this
is *visual inspiration for Orbit HR* — none of Keka's branding, naming, or
assets are used.

## Typography

- **Font**: [Nunito Sans](https://fonts.google.com/specimen/Nunito+Sans) —
  Keka's actual body font. Loaded via `next/font/google` in `app/layout.tsx`
  as `--font-nunito-sans`, wired to Tailwind's `--font-sans` in
  `globals.css`. (Keka pairs it with `tt-commons-pro` for headings, which is
  a paid Adobe font, so Nunito Sans carries both roles here.) Keka's own
  weight usage is 400/500/600, which matches what this app already used.
  - ⚠️ Historical note: the original setup used Geist, but a copy-paste bug
    (`--font-sans: var(--font-sans)` — self-referential) meant it was
    **never actually applied**; the app silently fell back to the OS default
    UI font. Fixed during the Inter switch, which Nunito Sans later replaced.
- **Monospace**: Geist Mono (`--font-geist-mono`), used only for
  `font-mono` text like employee IDs.
- **Heading scale**: page titles and hero numbers were deliberately sized up
  from the shadcn defaults:
  - Card titles: `text-lg font-semibold tracking-tight` (was `text-base font-medium`)
  - Page greeting/date headers (Dashboard, Attendance): `text-2xl`
  - Stat card hero numbers: `text-3xl font-semibold tracking-tight`
  - Employee profile name: `text-2xl`
  - Sub-section card titles (e.g. "Job details", "Leave balance"): `text-base` (was `text-sm`)

## Color system

All colors are defined as CSS custom properties in `globals.css`, themed for
light/dark via `:root` / `.dark`. Three families:

### 1. Semantic theme tokens
Standard shadcn tokens (`--primary`, `--card`, `--muted`, `--border`, etc.),
retuned to the Keka-inspired purple system:

| Token | Light | Dark | Role |
|---|---|---|---|
| `--primary` | `#7c46f1` | `#9c7bf5` | Brand purple — buttons, active nav, focus |
| `--background` | `#f8f9fc` | `#0b0015` | Page plane (tinted, so cards lift off it) |
| `--card` / `--sidebar` | `#ffffff` | `#17102a` / `#12091f` | Chrome + content surfaces |
| `--accent` | `#f5f0ff` | `#2a1e47` | Lavender wash for hover/active states |
| `--radius` | `0.875rem` | — | Bumped from `0.625rem` for the softer look |

The tinted page + white cards split is what gives the layout its depth —
before this, page and cards were both pure white and separated only by a
hairline ring. `SiteHeader` uses `bg-card` (not `bg-background`) so the top
bar reads as chrome alongside the sidebar.

### 2. Chart palette (`--chart-1` … `--chart-5`)
From the `dataviz` skill's validated categorical palette. **Do not swap
these for arbitrary hex values without re-running the palette validator** —
adjacent-hue separation under colorblindness simulation is the
accessibility mechanism, not a cosmetic choice.

Slot 1 was changed from blue to the brand purple `#7c46f1` so charts sit in
the brand family. This was **validated, not eyeballed** —
`node scripts/validate_palette.js "#7c46f1,#eb6834" --mode light` passes
every gate, with the purple↔orange pair separating at ΔE 31.7 under CVD
simulation (floor is 8) and 35.8 for normal vision (floor is 15). The dark
step `#9c7bf5` passes the dark-surface checks the same way. If you change a
chart hue again, re-run that script before shipping it.

### 3. Extended categorical palette (`--cat-1` … `--cat-8`)
The chart hues extended to 8, used for **identity tagging** outside of
charts — department tags, leave-type tags. (When purple took slot 1, the
old blue `#2a78d6` moved to slot 7 so no hue was lost.) Defined in
`src/lib/colors.ts`:

```ts
departmentColor("Engineering")       // → var(--cat-1), fixed mapping
leaveTypeColor("Sick")               // → var(--cat-2), fixed mapping
avatarFill("Ananya Rao")             // → "#2563eb", hashed from name
```

- **Department/leave-type colors are a fixed lookup table**, not hashed —
  so "Engineering" is always blue, deliberately, the same way a chart
  legend never changes color when you filter it.
- **Avatar colors are hashed from the person's name** into a *separate*
  8-color palette (`AVATAR_FILLS` in `colors.ts`) — darker/more saturated
  steps of the same hue families, picked so white initials text stays
  legible on every one (the chart palette's yellow/magenta are too light
  for that; using them for avatar text would fail contrast).

### Status colors (`src/lib/status.ts`)
A separate, fixed palette for state — `good` (green), `warning` (amber),
`serious`, `critical` (red), `info` (blue), `neutral` (gray) — reused across
employee status, attendance status, and leave status. Kept deliberately
distinct from the categorical palette so a status dot never gets confused
with a department tag.

## Shared components

| Component | Purpose | Location |
|---|---|---|
| `<StatusIndicator color label />` | Small dot + label, for state (Active, Present, Pending, ...) | `components/status-indicator.tsx` |
| `<Tag color>children</Tag>` | Colored pill (dot + tinted background), for identity (department, leave type) | `components/tag.tsx` |
| `<PersonAvatar name initials />` | Solid-color avatar bubble, color hashed from name | `components/person-avatar.tsx` |

**Why `Tag` uses a dot + tinted background instead of colored text**: the
dataviz skill's rule is "text never wears the data color" — several palette
hues (yellow, magenta) fail text contrast on a light background. A tinted
background wash has no contrast requirement (it's decorative), so identity
comes from the dot, and the label stays in normal foreground ink and stays
legible regardless of which of the 8 hues it got.

## Sidebar active state

Hand-edited in `components/ui/sidebar.tsx` (the shadcn-generated file) —
`data-active` state now renders a tinted primary-color background + a 2px
inset left accent bar + primary-colored text, instead of the shadcn default
flat gray highlight. This is the one shared UI primitive worth knowing was
customized, since a future `npx shadcn add sidebar --overwrite` would wipe
it.
