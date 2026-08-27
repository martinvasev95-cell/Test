import exifr from 'exifr';

export interface PhotoMetadata {
  lat: number | null;
  lng: number | null;
  dateTaken: Date | null;
}

/**
 * Reads GPS coordinates and the capture date out of a photo's EXIF data.
 * Photos without an embedded location (screenshots, downloaded images,
 * photos with location services off) come back with lat/lng as null and
 * are skipped by the caller — there's no way to place them on the map.
 */
export async function readPhotoMetadata(file: File): Promise<PhotoMetadata> {
  try {
    const exif = await exifr.parse(file, { tiff: true, exif: true, gps: true });
    const lat = typeof exif?.latitude === 'number' ? exif.latitude : null;
    const lng = typeof exif?.longitude === 'number' ? exif.longitude : null;
    const dateTaken: Date | null =
      exif?.DateTimeOriginal instanceof Date
        ? exif.DateTimeOriginal
        : exif?.CreateDate instanceof Date
          ? exif.CreateDate
          : null;
    return { lat, lng, dateTaken };
  } catch {
    // Not every image has (readable) EXIF — treat that as "no location".
    return { lat: null, lng: null, dateTaken: null };
  }
}
