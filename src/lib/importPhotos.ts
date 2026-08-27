import type { ImportSummary, PendingPhoto, Visit } from '../types';
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
 * thumbnail. Photos with no usable GPS — notably, every photo picked via
 * iOS Safari, since iOS strips location data before handing photos to a
 * website — come back as "pending" instead of being dropped, so the caller
 * can offer manual country assignment.
 */
export async function importPhotos(
  files: File[],
  onProgress?: (done: number, total: number) => void,
): Promise<{ visits: Visit[]; pending: PendingPhoto[]; summary: ImportSummary }> {
  const visits: Visit[] = [];
  const pending: PendingPhoto[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const { lat, lng, dateTaken } = await readPhotoMetadata(file);
    const dateTakenIso = dateTaken ? dateTaken.toISOString() : null;
    const country = lat !== null && lng !== null ? findCountryForPoint(lng, lat) : null;

    if (!country) {
      const photoDataUrl = await makeThumbnail(file);
      pending.push({
        id: makeId(),
        fileName: file.name,
        dateTaken: dateTakenIso,
        photoDataUrl,
      });
      onProgress?.(i + 1, files.length);
      continue;
    }

    const photoDataUrl = await makeThumbnail(file);

    visits.push({
      id: makeId(),
      countryId: String(country.id),
      countryName: country.properties?.name ?? 'Unknown',
      dateTaken: dateTakenIso,
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
    pending,
    summary: {
      imported: visits.length,
      pending: pending.length,
      total: files.length,
    },
  };
}
