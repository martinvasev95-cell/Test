# Daily Check-In

A tiny, private daily habit tracker: five bubbles you tap green or red for
whether you've done each thing today.

- **Gym**
- **Run**
- **Protein / Creatine**
- **Macros** (tracked macros / ate clean)
- **Abs**

## How it works

- Tap a bubble to cycle it: **not logged** (grey) → **done** (green) →
  **missed** (red) → back to not logged. One tap for the common case
  (marking something done), a second if you need to correct it.
- A **streak** counter shows how many days in a row you've gone 5-for-5.
  Today only joins the streak once it's fully checked off, so it doesn't
  reset to zero every morning before you've logged anything.
- The **log** below today's bubbles is grouped by **week (Monday–Sunday)**
  and **month**, each with its own summary (full days logged, and % of
  habits completed) — so a bad week doesn't hide inside "the last 14 days"
  once it's over. Tap any day's dots to fix one you forgot to log. A brand
  new tracker shows a few weeks of empty calendar structure; it keeps
  extending back through your history (up to ~3 months at a time) as you
  use it.
- **Storage** is your browser's `localStorage`, on-device only. Nothing is
  uploaded anywhere. That means it's local to one browser (won't sync
  across devices) and clearing site data clears it.

## Installing it as an app

This is an installable PWA (Progressive Web App): once it's hosted over
HTTPS (see Deploying below), you can add it to your phone's home screen
and it opens full-screen, with its own icon, like a native app.

- **iPhone (Safari)**: open the site → Share → **Add to Home Screen**.
- **Android (Chrome)**: open the site → menu (⋮) → **Add to Home screen** /
  **Install app**.
- **Desktop (Chrome/Edge)**: click the install icon in the address bar, or
  menu → **Install Daily Check-In**.

It also works offline after the first visit — a small service worker
(`public/sw.js`) caches the app shell so you can still log a day with no
signal.

## Why manual input instead of Oura / Whoop / Apple Health / Equinox

Those all need a live backend: an OAuth app registered with each provider,
a server to hold client secrets and refresh tokens, and (for Apple Health)
a native iOS app, since Health data isn't reachable from a website at all.
This app is a static site with no server, so wiring one up wasn't a "make
it fancier" choice so much as a different, much bigger project — and combined,
those providers each behave differently enough that "just track a boolean"
would tell you less than tapping a bubble does. Manual input also keeps
your data private and instant to use.

If you want to add one later, the natural entry point is `DayEntry` in
`src/types.ts` — add a `source: 'manual' | 'oura' | ...` field, and a sync
step that calls that provider's API (from a small backend you control) and
merges results into the same `TrackerData` shape the UI already renders.

## Development

```bash
npm install
npm run dev      # start the dev server
npm run build    # type-check and build for production
npm run lint      # oxlint
```

## Deploying

`npm run build` produces a static `dist/` folder — it can be hosted
anywhere that serves static files (GitHub Pages, Netlify, Vercel, etc.).
A PWA install prompt and the offline service worker both require HTTPS,
which GitHub Pages provides by default.
