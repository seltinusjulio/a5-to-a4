import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { DocumentMetadata, PageCropBox } from '../types/booklet';

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export interface LoadedPdfDoc {
  pdfDocument: pdfjsLib.PDFDocumentProxy;
  metadata: DocumentMetadata;
  arrayBuffer: ArrayBuffer;
}

// Memory cache for rendered thumbnail data URLs: key is `docId_pageNumber_scale_cropped`
const thumbnailCache = new Map<string, string>();

const getPdfjsAssetBase = (): string => {
  const base = (import.meta.env.BASE_URL || '/').trim();
  return base.endsWith('/') ? base : `${base}/`;
};

/**
 * Loads a PDF file and extracts core metadata.
 */
export async function loadPdfDocument(file: File): Promise<LoadedPdfDoc> {
  const arrayBuffer = await file.arrayBuffer();
  // Using a copy of arrayBuffer because pdfjs may transfer it
  const bufferCopy = arrayBuffer.slice(0);
  const assetBase = getPdfjsAssetBase();

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    cMapUrl: `${assetBase}pdfjs/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${assetBase}pdfjs/standard_fonts/`,
  });

  const pdfDocument = await loadingTask.promise;
  const numPages = pdfDocument.numPages;

  // Inspect first page dimensions
  let widthPt = 420.95;
  let heightPt = 595.28;
  if (numPages > 0) {
    const firstPage = await pdfDocument.getPage(1);
    const viewport = firstPage.getViewport({ scale: 1 });
    widthPt = viewport.width;
    heightPt = viewport.height;
  }

  // Convert points to mm: 1 pt = 25.4 / 72 mm
  const widthMm = Math.round((widthPt * 25.4) / 72);
  const heightMm = Math.round((heightPt * 25.4) / 72);

  // ISO A5 portrait is approx 148 x 210 mm (tolerance +- 6mm)
  const isA5Estimated =
    Math.abs(widthMm - 148) <= 10 &&
    Math.abs(heightMm - 210) <= 10 &&
    heightPt > widthPt;

  const paddedPageCount = Math.max(4, Math.ceil(numPages / 4) * 4);
  const blankPagesAdded = paddedPageCount - numPages;
  const totalSheets = paddedPageCount / 4;

  const dimensionsDescription = isA5Estimated
    ? `A5 Potret (${widthMm} × ${heightMm} mm)`
    : `${widthMm} × ${heightMm} mm (${heightPt > widthPt ? 'Potret' : 'Lanskap'})`;

  const metadata: DocumentMetadata = {
    filename: file.name,
    fileSizeBytes: file.size,
    originalPageCount: numPages,
    paddedPageCount,
    blankPagesAdded,
    totalSheets,
    pageWidthPt: widthPt,
    pageHeightPt: heightPt,
    isA5Estimated,
    dimensionsDescription,
    detectedWidthMm: widthMm,
    detectedHeightMm: heightMm,
  };

  return {
    pdfDocument,
    metadata,
    arrayBuffer: bufferCopy,
  };
}

/**
 * Loads a PDF from an ArrayBuffer directly (used for sample generation).
 */
export async function loadPdfFromArrayBuffer(
  arrayBuffer: ArrayBuffer,
  filename: string
): Promise<LoadedPdfDoc> {
  const bufferCopy = arrayBuffer.slice(0);
  const assetBase = getPdfjsAssetBase();

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    cMapUrl: `${assetBase}pdfjs/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${assetBase}pdfjs/standard_fonts/`,
  });

  const pdfDocument = await loadingTask.promise;
  const numPages = pdfDocument.numPages;

  let widthPt = 420.95;
  let heightPt = 595.28;
  if (numPages > 0) {
    const firstPage = await pdfDocument.getPage(1);
    const viewport = firstPage.getViewport({ scale: 1 });
    widthPt = viewport.width;
    heightPt = viewport.height;
  }

  const widthMm = Math.round((widthPt * 25.4) / 72);
  const heightMm = Math.round((heightPt * 25.4) / 72);
  const isA5Estimated = true;

  const paddedPageCount = Math.max(4, Math.ceil(numPages / 4) * 4);
  const blankPagesAdded = paddedPageCount - numPages;
  const totalSheets = paddedPageCount / 4;

  const metadata: DocumentMetadata = {
    filename,
    fileSizeBytes: arrayBuffer.byteLength,
    originalPageCount: numPages,
    paddedPageCount,
    blankPagesAdded,
    totalSheets,
    pageWidthPt: widthPt,
    pageHeightPt: heightPt,
    isA5Estimated,
    dimensionsDescription: `A5 Potret (${widthMm} × ${heightMm} mm)`,
    detectedWidthMm: widthMm,
    detectedHeightMm: heightMm,
  };

  return {
    pdfDocument,
    metadata,
    arrayBuffer: bufferCopy,
  };
}

/**
 * Renders a single page of a PDF document to a data URL string.
 */
export async function renderPageThumbnail(
  pdfDocument: pdfjsLib.PDFDocumentProxy,
  pageNumber: number,
  targetWidth: number = 360,
  cropBox?: PageCropBox
): Promise<string> {
  const isCropped = cropBox && cropBox.hasCropped;
  const cacheKey = `${pdfDocument.fingerprints?.[0] || 'doc'}_${pageNumber}_${targetWidth}_${isCropped ? `${cropBox.x}_${cropBox.y}_${cropBox.width}` : 'full'}`;
  if (thumbnailCache.has(cacheKey)) {
    return thumbnailCache.get(cacheKey)!;
  }

  try {
    const page = await pdfDocument.getPage(pageNumber);
    const unscaledViewport = page.getViewport({ scale: 1 });
    const scale = targetWidth / unscaledViewport.width;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    const context = canvas.getContext('2d', { alpha: false });
    if (!context) {
      throw new Error('Failed to get 2D canvas context');
    }

    // Fill white background first
    context.fillStyle = '#FFFFFF';
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Modern pdfjs-dist RenderParameters
    const renderContext = {
      canvasContext: context,
      viewport,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (page.render as any)(renderContext).promise;

    if (isCropped && cropBox) {
      const px = (cropBox.x / cropBox.originalWidth) * canvas.width;
      const pw = (cropBox.width / cropBox.originalWidth) * canvas.width;
      const py = ((cropBox.originalHeight - (cropBox.y + cropBox.height)) / cropBox.originalHeight) * canvas.height;
      const ph = (cropBox.height / cropBox.originalHeight) * canvas.height;

      const croppedCanvas = document.createElement('canvas');
      croppedCanvas.width = Math.max(10, Math.floor(pw));
      croppedCanvas.height = Math.max(10, Math.floor(ph));
      const cropCtx = croppedCanvas.getContext('2d');
      if (cropCtx) {
        cropCtx.drawImage(canvas, px, py, pw, ph, 0, 0, croppedCanvas.width, croppedCanvas.height);
        const dataUrl = croppedCanvas.toDataURL('image/jpeg', 0.88);
        thumbnailCache.set(cacheKey, dataUrl);
        return dataUrl;
      }
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    thumbnailCache.set(cacheKey, dataUrl);
    return dataUrl;
  } catch (err) {
    console.error(`Error rendering page ${pageNumber}:`, err);
    return '';
  }
}

/**
 * Clears the thumbnail cache when loading new documents or changing crop settings.
 */
export function clearThumbnailCache() {
  thumbnailCache.clear();
}

