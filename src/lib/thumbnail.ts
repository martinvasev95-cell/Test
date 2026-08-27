const MAX_DIMENSION = 1400;
const JPEG_QUALITY = 0.78;

/**
 * Downscales an image file to a reasonably sized, compressed JPEG data URL.
 * Full-resolution iPhone photos (often 3-5MB each) would blow through
 * IndexedDB quotas quickly across a whole trip's worth of photos, so
 * everything gets resized on import — this is also what's shown in the UI.
 */
export async function makeThumbnail(file: File): Promise<string> {
  // Respect the EXIF orientation tag — otherwise portrait iPhone photos
  // can come out sideways depending on the browser's default.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    ctx.drawImage(bitmap, 0, 0, width, height);

    return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  } finally {
    bitmap.close();
  }
}
