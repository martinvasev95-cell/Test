/** A single photo tied to a country, extracted from an imported image's EXIF data
 *  or, when EXIF has no location (see PendingPhoto), assigned manually. */
export interface Visit {
  /** Stable id for this record (used as the IndexedDB key and React list key). */
  id: string;
  /** ISO 3166-1 numeric country code, as used by the bundled world-atlas topology. */
  countryId: string;
  /** Human-readable country name, cached at import time. */
  countryName: string;
  /** ISO date string the photo was taken, when known from EXIF or file metadata. */
  dateTaken: string | null;
  /** GPS coordinates the photo was geotagged with, when known from EXIF. Photos
   *  assigned a country manually (no EXIF GPS) have no coordinates. */
  lat: number | null;
  lng: number | null;
  /** Resized, compressed JPEG data URL — kept small enough to store many of these in IndexedDB. */
  photoDataUrl: string;
  /** Original filename, shown in the UI for context. */
  fileName: string;
  /** When this record was imported into the app. */
  addedAt: string;
}

/**
 * A processed photo that couldn't be placed automatically — usually because
 * iOS strips GPS data from photos handed to a website through Safari's photo
 * picker, even when the original photo is geotagged. Held in memory so the
 * user can assign it a country by hand instead of losing it.
 */
export interface PendingPhoto {
  id: string;
  fileName: string;
  dateTaken: string | null;
  photoDataUrl: string;
}

/** Outcome of importing a batch of photos, for the summary shown to the user. */
export interface ImportSummary {
  imported: number;
  pending: number;
  total: number;
}
