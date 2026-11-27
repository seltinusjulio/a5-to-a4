import { PageCropBox } from '../types/booklet';

// In-memory cache for detected crop boxes: key is `${docFingerprint}_${pageNumber}_${paddingMm}`
const cropCache = new Map<string, PageCropBox>();

/**
 * Detects the bounding box of actual visible content on a PDF page by analyzing pixel luminance.
 */
export async function detectPageCropBox(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pdfPage: any,
  docId: string = 'doc',
  pageNumber: number = 1,
  paddingMm: number = 3,
  threshold: number = 245
): Promise<PageCropBox> {
  const cacheKey = `${docId}_${pageNumber}_${paddingMm}_${threshold}`;
  if (cropCache.has(cacheKey)) {
    return cropCache.get(cacheKey)!;
  }

  // Use scale 1.0 (72 DPI) for fast and accurate pixel analysis
  const viewport = pdfPage.getViewport({ scale: 1.0 });
  const width = Math.floor(viewport.width);
  const height = Math.floor(viewport.height);

  if (typeof document === 'undefined') {
    return {
      x: 0,
      y: 0,
      width: viewport.width,
      height: viewport.height,
      originalWidth: viewport.width,
      originalHeight: viewport.height,
      hasCropped: false,
    };
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    const fallback: PageCropBox = {
      x: 0,
      y: 0,
      width: viewport.width,
      height: viewport.height,
      originalWidth: viewport.width,
      originalHeight: viewport.height,
      hasCropped: false,
    };
    return fallback;
  }

  // Fill canvas with white before rendering
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (pdfPage.render as any)({
      canvasContext: ctx,
      viewport,
    }).promise;

    const imgData = ctx.getImageData(0, 0, width, height);
    const pixels = imgData.data;

    let minX = width;
    let maxX = -1;
    let minY = height;
    let maxY = -1;

    // Scan pixels: a pixel is non-white if any RGB channel is below threshold
    // Skip borders slightly (2px) to ignore scan edge artifacts or black scanner frame lines
    for (let y = 2; y < height - 2; y += 2) {
      for (let x = 2; x < width - 2; x += 2) {
        const idx = (y * width + x) * 4;
        const r = pixels[idx];
        const g = pixels[idx + 1];
        const b = pixels[idx + 2];

        // If significantly darker than background white
        if (r < threshold || g < threshold || b < threshold) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    // Check if any content was detected
    if (minX > maxX || minY > maxY) {
      // Entirely blank page
      const result: PageCropBox = {
        x: 0,
        y: 0,
        width: viewport.width,
        height: viewport.height,
        originalWidth: viewport.width,
        originalHeight: viewport.height,
        hasCropped: false,
      };
      cropCache.set(cacheKey, result);
      return result;
    }

    // Convert padding mm to points (1 mm = 72 / 25.4 points)
    const paddingPt = (paddingMm * 72) / 25.4;

    // Add safe breathing room padding around content
    const paddedMinX = Math.max(0, minX - paddingPt);
    const paddedMaxX = Math.min(width, maxX + paddingPt);
    const paddedMinY = Math.max(0, minY - paddingPt);
    const paddedMaxY = Math.min(height, maxY + paddingPt);

    const croppedW = paddedMaxX - paddedMinX;
    const croppedH = paddedMaxY - paddedMinY;

    // If cropped area covers > 94% of the original page width and height,
    // don't crop to avoid tiny useless trims
    const ratioW = croppedW / width;
    const ratioH = croppedH / height;
    if (ratioW > 0.94 && ratioH > 0.94) {
      const result: PageCropBox = {
        x: 0,
        y: 0,
        width: viewport.width,
        height: viewport.height,
        originalWidth: viewport.width,
        originalHeight: viewport.height,
        hasCropped: false,
      };
      cropCache.set(cacheKey, result);
      return result;
    }

    // Convert to PDF coordinates (PDF origin (0,0) is bottom-left, Canvas origin is top-left)
    const pdfX = paddedMinX;
    const pdfY = height - paddedMaxY; // bottom-left Y
    const pdfWidth = croppedW;
    const pdfHeight = croppedH;

    const result: PageCropBox = {
      x: pdfX,
      y: pdfY,
      width: pdfWidth,
      height: pdfHeight,
      originalWidth: viewport.width,
      originalHeight: viewport.height,
      hasCropped: true,
    };

    cropCache.set(cacheKey, result);
    return result;
  } catch (err) {
    console.error(`Error detecting crop box for page ${pageNumber}:`, err);
    const fallback: PageCropBox = {
      x: 0,
      y: 0,
      width: viewport.width,
      height: viewport.height,
      originalWidth: viewport.width,
      originalHeight: viewport.height,
      hasCropped: false,
    };
    return fallback;
  }
}

/**
 * Clears the auto-crop cache.
 */
export function clearCropCache() {
  cropCache.clear();
}
