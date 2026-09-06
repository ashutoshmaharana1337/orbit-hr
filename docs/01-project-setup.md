# Project Setup

How `web/` was scaffolded, and two environment-specific issues you'll hit
again if you ever rebuild this from scratch on this machine (or a similarly
locked-down Windows box).

## What was run

```bash
npx create-next-app@latest web --typescript --tailwind --eslint --app \
  --src-dir --import-alias "@/*" --use-npm --turbopack --no-git

npx shadcn@latest init -d
npx shadcn@latest add button card table avatar badge input label separator \
  tabs dialog dropdown-menu sheet select progress tooltip scroll-area \
  breadcrumb sidebar skeleton calendar popover chart -y
```

## Issue 1: global npm `allow-scripts` policy blocks installs

This machine has a **global** npm config (`C:\Users\ashut\AppData\Roaming\npm\etc\npmrc`)
setting `allow-scripts=["opencode-ai"]` — an allowlist restricting which
packages may run lifecycle scripts. Any plain project-scoped `npm install`
fails immediately with:

```
npm error code EALLOWSCRIPTS
npm error --allow-scripts is not allowed in project-scoped installs.
```

**Fix**: `web/.npmrc` overrides it at the project level:

```
ignore-scripts=true
allow-scripts=
```

Setting `allow-scripts=` (empty) locally clears the inherited global list;
`ignore-scripts=true` then skips lifecycle scripts entirely. This is why the
shadcn CLI's first `init` attempt silently failed halfway (wrote
`components.json` but never installed dependencies or the theme CSS) — it
had to be re-run after the `.npmrc` fix with `-f` to force-overwrite.

**If you add packages later**: this `.npmrc` is already in place, so normal
`npm install` in `web/` will work. If you ever need a package's postinstall
script to actually run (rare), you'll need to explicitly allowlist it.

## Issue 2: Turbopack's native binary is blocked

Windows Application Control policy blocks
`node_modules/@next/swc-win32-x64-msvc/next-swc.win32-x64-msvc.node`, so
Turbopack (Next.js 16's default bundler) can't load native bindings and
falls back to WASM-only — which doesn't support Turbopack, so `next build`
and `next dev` fail outright.

**Fix**: `web/package.json` scripts explicitly pass `--webpack`:

```json
"dev": "next dev --webpack",
"build": "next build --webpack",
```

You'll still see a harmless warning line on every command:
```
⚠ Attempted to load @next/swc-win32-x64-msvc, but an error occurred: An Application Control policy has blocked this file.
```
This is expected and doesn't affect the build — webpack doesn't need that
binary.

## Running it

```bash
cd web
npm run dev     # http://localhost:3000
npm run build   # production build check
```

No `.env` or database needed yet — everything renders from
`src/lib/mock-data.ts`.
