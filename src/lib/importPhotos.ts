import type { ImportSummary, Visit } from '../types';
import { readPhotoMetadata } from './exif';
import { findCountryForPoint } from './countries';
import { makeThumbnail } from './thumbnail';

function makeId(): string {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Turns a batch of picked photo files into Visit records: reads GPS + date
 * from EXIF, reverse-geocodes to a country offline, and builds a stored
 * thumbnail. Photos without usable GPS data are skipped since there's
 * nowhere on the map to put them.
 */
export async function importPhotos(
  files: File[],
  onProgress?: (done: number, total: number) => void,
): Promise<{ visits: Visit[]; summary: ImportSummary }> {
  const visits: Visit[] = [];
  let skippedNoGps = 0;
  let skippedNoCountryMatch = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const { lat, lng, dateTaken } = await readPhotoMetadata(file);

    if (lat === null || lng === null) {
      skippedNoGps++;
      onProgress?.(i + 1, files.length);
      continue;
    }

    const country = findCountryForPoint(lng, lat);
    if (!country) {
      skippedNoCountryMatch++;
      onProgress?.(i + 1, files.length);
      continue;
    }

    const photoDataUrl = await makeThumbnail(file);

    visits.push({
      id: makeId(),
      countryId: String(country.id),
      countryName: country.properties?.name ?? 'Unknown',
      dateTaken: dateTaken ? dateTaken.toISOString() : null,
      lat,
      lng,
      photoDataUrl,
      fileName: file.name,
      addedAt: new Date().toISOString(),
    });

    onProgress?.(i + 1, files.length);
  }

  return {
    visits,
    summary: {
      imported: visits.length,
      skippedNoGps,
      skippedNoCountryMatch,
      total: files.length,
    },
  };
}
