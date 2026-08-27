# Travel Map

A private, offline-first map of the countries you've visited, built from
your own photos. Import photos from your phone's library, and any photo
with location data gets pinned to its country — click a highlighted
country to see the date and photo.

## How it works

- **Import** taps the browser's native photo picker (`<input type="file"
  accept="image/*" multiple>`). On an iPhone, opening this in Safari and
  tapping "Import photos" brings up the actual Photos library picker —
  there's no other way for a website to reach a device's photo library,
  since iOS doesn't expose one to the browser.
- **Location & date** are read straight out of each photo's EXIF data
  (GPS coordinates + capture date), entirely in the browser.
- **Country matching** is done offline with a point-in-polygon lookup
  against bundled world boundaries — no geocoding API, no network call.
- **Storage** is your browser's IndexedDB, on-device only. Nothing is
  uploaded anywhere. That also means the data is local to one browser —
  it won't sync across devices, and clearing site data clears it.
- Photos are resized/compressed on import (max 1400px, JPEG) so a
  trip's worth of photos doesn't blow past storage limits.

### About location data on iPhone

iOS strips GPS metadata from photos before handing them to a website,
even when the original photo is geotagged — this is a platform privacy
restriction, not something a website can opt out of. In practice this
means **most photos picked via Safari on iPhone will have no location
data**, no matter how the photo was originally taken. When that happens,
the photo isn't dropped — it shows up in a "couldn't detect a location"
list where you pick the country by hand (the capture date is usually
still present, since only location is scrubbed). Photos genuinely
missing both GPS and a capture date (e.g. screenshots) can still be
kept this way, just with the date left blank.

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
Since it needs to run in your phone's browser to use the photo picker,
serving it over HTTPS is required.
