/** A single photo tied to a country, extracted from an imported image's EXIF data. */
export interface Visit {
  /** Stable id for this record (used as the IndexedDB key and React list key). */
  id: string;
  /** ISO 3166-1 numeric country code, as used by the bundled world-atlas topology. */
  countryId: string;
  /** Human-readable country name, cached at import time. */
  countryName: string;
  /** ISO date string the photo was taken, when known from EXIF or file metadata. */
  dateTaken: string | null;
  /** GPS coordinates the photo was geotagged with. */
  lat: number;
  lng: number;
  /** Resized, compressed JPEG data URL — kept small enough to store many of these in IndexedDB. */
  photoDataUrl: string;
  /** Original filename, shown in the UI for context. */
  fileName: string;
  /** When this record was imported into the app. */
  addedAt: string;
}

/** Outcome of importing a batch of photos, for the summary shown to the user. */
export interface ImportSummary {
  imported: number;
  skippedNoGps: number;
  skippedNoCountryMatch: number;
  total: number;
}
