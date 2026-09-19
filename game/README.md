# Cola & Crumb

A blind tasting game for a dinner party: seven colas and four breads, guessed
from dropdowns on your guests' phones, with a lowest-score-first reveal on
the television.

Everything runs from your laptop over your own Wi-Fi. No accounts, no
installs, no internet needed once the page has loaded — guests just scan the
code on the TV.

## Running it tonight

You need Node 18 or newer. There is nothing to install.

```bash
node game/server.js
```

It prints something like:

```
  Guests   http://192.168.1.14:7777
  TV       http://192.168.1.14:7777/tv
  You      http://192.168.1.14:7777/admin     PIN 4821
```

1. Put **the TV page** on the big screen (full screen, `F11`). It shows a QR
   code and the join address.
2. Open **the admin page** on your own laptop or phone and enter the PIN.
3. Guests scan the code, type a name, and they are in.

Your laptop and your guests' phones must be on the same Wi-Fi. If guests get
a connection error, the server also prints the other addresses your machine
has; re-run with the one that matches your network:

```bash
JOIN_URL=http://192.168.0.31:7777 node game/server.js
```

Other settings: `PORT` (default `7777`) and `ADMIN_PIN` (default: a random
four-digit PIN printed at startup).

## Running the game

The admin page has a **run of show** — five steps, in order:

1. **Guests join.** The TV shows the QR code and names appear as people join.
2. **Tasting.** Use the `‹ ›` stepper to move through Glass 1–7 and Slice
   A–D. The TV shows the current one in large type, and it is highlighted on
   every guest's phone. Guests can answer in any order; answers save as they
   are picked.
3. **Close voting.** Locks every card. Anyone who filled anything in but
   forgot to press *Hand in my card* is handed in automatically.
4. **Reveal.** Press *Reveal next* once per person. It goes **lowest score
   first**, so the winner is last. Each reveal shows that person's name,
   their score, and every answer they got right and wrong.
5. **Final table.** Everyone ranked, plus what was actually in each glass.

### The answer key

Set it before the reveal — the reveal is blocked until all eleven are filled.

*Shuffle pour order* makes a random assignment for you; pour to match it, or
pour first and then record what you did. Only the admin page ever shows it,
and the server does not release it to anyone until the reveal starts.

### If something goes sideways

- **A guest closes the tab.** Their answers are on the server. Reopening the
  link puts them back where they were.
- **You close the laptop / restart the server.** The game is saved to
  `game/data.json` after every change and reloads on startup.
- **You want a second round.** *New round* clears the answers but keeps
  everyone joined, so nobody has to scan again.
- **You revealed too early.** *Back* steps the reveal backwards.

## Changing what is being tasted

The seven colas and four breads are two arrays at the top of
`game/server.js`. Rename them to whatever you are actually serving — `name`
is what guests see, `short` is the abbreviation in the admin table, and `id`
is only stored internally.

```js
const BREADS = [
  { id: 'gf', name: 'Gluten-free', short: 'GF' },
  ...
];
```

Change the number of entries and the glasses, slices, scoring and reveal all
follow.

## How it is put together

No dependencies, and no build step.

| File | What it does |
| --- | --- |
| `server.js` | HTTP server, game state, scoring, live updates over server-sent events, JSON file persistence |
| `lib/qr.js` | QR encoder, so the join code works with no internet and no library |
| `views/tv.html` | The big screen |
| `views/player.html` | The guests' phones |
| `views/admin.html` | Your control desk |
| `views/app.css` | Shared palette and components |
| `views/app.js` | Shared client helpers |

The guest pages hold no secrets: the answer key and everyone's cards are
served only to a request carrying the admin PIN, and the key is withheld from
the public feed until you start the reveal.

`lib/qr.js` is a from-scratch byte-mode encoder at error-correction level M,
versions 1–10. It was checked module-for-module against a reference
implementation across all eight mask patterns, and its output was decoded
back with an independent decoder for every join URL shape the server emits.
