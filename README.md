# Daily Check-In

A tiny, private daily habit tracker: four bubbles you tap green or red for
whether you've done each thing today.

- **Gym**
- **Run**
- **Protein / Creatine**
- **Macros** (tracked macros / ate clean)

## How it works

- Tap a bubble to cycle it: **not logged** (grey) → **done** (green) →
  **missed** (red) → back to not logged. One tap for the common case
  (marking something done), a second if you need to correct it.
- A **streak** counter shows how many days in a row you've gone 4-for-4.
  Today only joins the streak once it's fully checked off, so it doesn't
  reset to zero every morning before you've logged anything.
- The **last 14 days** are listed below today's bubbles, each as a row of
  four small dots — tap any of them to fix a day you forgot to log.
- **Storage** is your browser's `localStorage`, on-device only. Nothing is
  uploaded anywhere. That means it's local to one browser (won't sync
  across devices) and clearing site data clears it.

## Why manual input instead of Oura / Whoop / Apple Health / Equinox

Those all need a live backend: an OAuth app registered with each provider,
a server to hold client secrets and refresh tokens, and (for Apple Health)
a native iOS app, since Health data isn't reachable from a website at all.
This app is a static site with no server, so wiring one up wasn't a "make
it fancier" choice so much as a different, much bigger project — and combined,
those four each behave differently enough that "just track 4 booleans"
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
