import { PDFDocument, PDFEmbeddedPage, rgb } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { ImpositionPageInfo, ImpositionResult, PageCropBox } from '../types/booklet';
import { detectPageCropBox } from './autoCrop';

// Standard A4 landscape dimensions in PostScript points (72 points = 1 inch)
// 297 mm = 841.89 pt, 210 mm = 595.28 pt
export const A4_WIDTH_PT = 841.89;
export const A4_HEIGHT_PT = 595.28;
export const A4_HALF_WIDTH_PT = A4_WIDTH_PT / 2; // 420.945 pt (Exact A5 width)

export interface GeneratePdfOptions {
  mode?: 'all' | 'odd-only' | 'even-only';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pdfjsDoc?: any; // optional loaded PDFDocumentProxy from pdfjs-dist for image compression
  onProgress?: (progressText: string, percentage?: number) => void;
}

/**
 * Renders a PDF page to optimized JPEG bytes using an offscreen canvas with optional crop box.
 */
async function renderPageToOptimizedJpg(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pdfjsDoc: any,
  pageNumber: number,
  scale: number,
  quality: number,
  cropBox?: PageCropBox | null
): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  const page = await pdfjsDoc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Cannot get 2d canvas context');

  // Solid white background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (page.render as any)({
    canvasContext: ctx,
    viewport,
  }).promise;

  let finalCanvas = canvas;
  let finalWidth = viewport.width;
  let finalHeight = viewport.height;

  if (cropBox && cropBox.hasCropped) {
    const px = (cropBox.x / cropBox.originalWidth) * canvas.width;
    const pw = (cropBox.width / cropBox.originalWidth) * canvas.width;
    const py =
      ((cropBox.originalHeight - (cropBox.y + cropBox.height)) / cropBox.originalHeight) *
      canvas.height;
    const ph = (cropBox.height / cropBox.originalHeight) * canvas.height;

    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = Math.max(10, Math.floor(pw));
    croppedCanvas.height = Math.max(10, Math.floor(ph));
    const cropCtx = croppedCanvas.getContext('2d', { alpha: false });
    if (cropCtx) {
      cropCtx.fillStyle = '#FFFFFF';
      cropCtx.fillRect(0, 0, croppedCanvas.width, croppedCanvas.height);
      cropCtx.drawImage(canvas, px, py, pw, ph, 0, 0, croppedCanvas.width, croppedCanvas.height);
      finalCanvas = croppedCanvas;
      finalWidth = cropBox.width;
      finalHeight = cropBox.height;
    }
  }

  const blob = await new Promise<Blob | null>((resolve) =>
    finalCanvas.toBlob((b) => resolve(b), 'image/jpeg', quality)
  );

  if (!blob) throw new Error('Failed to encode page to JPEG');
  const buffer = await blob.arrayBuffer();

  return {
    bytes: new Uint8Array(buffer),
    width: finalWidth,
    height: finalHeight,
  };
}

/**
 * Builds the imposed A4 Landscape PDF using pdf-lib with custom margins, gutter,
 * scale options, auto-crop of white margins, and image optimization compression techniques.
 */
export async function generateBookletPdf(
  sourcePdfBytes: Uint8Array | ArrayBuffer,
  imposition: ImpositionResult,
  exportOptions: GeneratePdfOptions = { mode: 'all' }
): Promise<Uint8Array> {
  const srcDoc = await PDFDocument.load(sourcePdfBytes, { ignoreEncryption: true });
  const outDoc = await PDFDocument.create();

  // Convert margin mm to points (1 inch = 25.4 mm = 72 pt)
  const outerMarginMm = imposition.options.outerMarginMm ?? imposition.options.marginMm ?? 3;
  const gutterMarginMm = imposition.options.gutterMarginMm ?? 2;

  const outerMarginPt = (outerMarginMm * 72) / 25.4;
  const gutterMarginPt = (gutterMarginMm * 72) / 25.4;

  // Available slot dimensions taking outer margin and spine gutter into account
  const slotWidth = Math.max(10, A4_HALF_WIDTH_PT - outerMarginPt - gutterMarginPt);
  const slotHeight = Math.max(10, A4_HEIGHT_PT - outerMarginPt * 2);

  const compressionLevel = imposition.options.compressionLevel || 'standard';
  const autoCropEnabled = Boolean(imposition.options.autoCropWhiteMargins);

  // Ensure pdfjsDoc is available if image optimization or auto-crop is requested
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pdfjsDoc = exportOptions.pdfjsDoc;
  if (!pdfjsDoc && (compressionLevel === 'balanced' || compressionLevel === 'compact' || autoCropEnabled)) {
    try {
      const copyBytes =
        sourcePdfBytes instanceof Uint8Array
          ? sourcePdfBytes.slice()
          : new Uint8Array(sourcePdfBytes).slice();
      const task = pdfjsLib.getDocument({ data: copyBytes });
      pdfjsDoc = await task.promise;
    } catch (e) {
      console.warn('Could not load pdfjsDoc for optimization/autocrop:', e);
    }
  }

  const shouldOptimizeImages =
    (compressionLevel === 'balanced' || compressionLevel === 'compact') && Boolean(pdfjsDoc);

  // Resolution and quality tuning based on chosen compression level
  // Balanced: ~200 DPI scale (2.0), quality 0.88 -> visually indistinguishable when printed, 50-70% size reduction
  // Compact: ~150 DPI scale (1.5), quality 0.76 -> ultra lightweight
  const renderScale = compressionLevel === 'compact' ? 1.5 : 2.0;
  const jpegQuality = compressionLevel === 'compact' ? 0.76 : 0.88;

  // Cache embedded elements per page
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const embeddedElementsMap = new Map<number, any>();

  const getPageDrawable = async (pageNumber: number) => {
    if (!embeddedElementsMap.has(pageNumber)) {
      let cropBox: PageCropBox | null = null;
      if (autoCropEnabled && pdfjsDoc) {
        try {
          if (exportOptions.onProgress) {
            exportOptions.onProgress(`Mendeteksi margin putih halaman ${pageNumber}...`);
          }
          const pageProxy = await pdfjsDoc.getPage(pageNumber);
          cropBox = await detectPageCropBox(
            pageProxy,
            imposition.metadata.filename,
            pageNumber,
            imposition.options.cropPaddingMm ?? 3,
            imposition.options.cropThreshold ?? 245
          );
        } catch (err) {
          console.warn(`Gagal memotong margin halaman ${pageNumber}:`, err);
        }
      }

      if (shouldOptimizeImages) {
        try {
          if (exportOptions.onProgress) {
            exportOptions.onProgress(`Mengompresi gambar halaman ${pageNumber}...`);
          }
          const { bytes, width, height } = await renderPageToOptimizedJpg(
            pdfjsDoc,
            pageNumber,
            renderScale,
            jpegQuality,
            cropBox
          );
          const embeddedJpg = await outDoc.embedJpg(bytes);
          embeddedElementsMap.set(pageNumber, {
            type: 'image',
            drawable: embeddedJpg,
            width,
            height,
          });
        } catch (err) {
          console.warn('Image optimization fallback to vector embed:', err);
          // Fallback to standard vector embedding if rasterization fails
          const srcPage = srcDoc.getPage(pageNumber - 1);
          let embedded: PDFEmbeddedPage;
          let width = srcPage.getWidth();
          let height = srcPage.getHeight();

          if (cropBox && cropBox.hasCropped) {
            embedded = await outDoc.embedPage(srcPage, {
              left: cropBox.x,
              bottom: cropBox.y,
              right: cropBox.x + cropBox.width,
              top: cropBox.y + cropBox.height,
            });
            width = cropBox.width;
            height = cropBox.height;
          } else {
            embedded = await outDoc.embedPage(srcPage);
            width = embedded.width;
            height = embedded.height;
          }

          embeddedElementsMap.set(pageNumber, {
            type: 'page',
            drawable: embedded,
            width,
            height,
          });
        }
      } else {
        const srcPage = srcDoc.getPage(pageNumber - 1);
        let embedded: PDFEmbeddedPage;
        let width = srcPage.getWidth();
        let height = srcPage.getHeight();

        if (cropBox && cropBox.hasCropped) {
          embedded = await outDoc.embedPage(srcPage, {
            left: cropBox.x,
            bottom: cropBox.y,
            right: cropBox.x + cropBox.width,
            top: cropBox.y + cropBox.height,
          });
          width = cropBox.width;
          height = cropBox.height;
        } else {
          embedded = await outDoc.embedPage(srcPage);
          width = embedded.width;
          height = embedded.height;
        }

        embeddedElementsMap.set(pageNumber, {
          type: 'page',
          drawable: embedded,
          width,
          height,
        });
      }
    }
    return embeddedElementsMap.get(pageNumber);
  };

  const drawPageInSlot = async (
    targetPage: ReturnType<typeof outDoc.addPage>,
    pageInfo: ImpositionPageInfo,
    isRightSlot: boolean
  ) => {
    if (pageInfo.isBlank || pageInfo.pageNumber === null) {
      // White space for blank page
      return;
    }

    const item = await getPageDrawable(pageInfo.pageNumber);
    const srcWidth = item.width;
    const srcHeight = item.height;

    // Calculate scale
    let scale = 1;
    if (imposition.options.scaleMode === 'actual' && item.type === 'page') {
      scale = 1;
    } else {
      scale = Math.min(slotWidth / srcWidth, slotHeight / srcHeight);
    }

    const scaledWidth = srcWidth * scale;
    const scaledHeight = srcHeight * scale;

    const slotOriginX = isRightSlot ? A4_HALF_WIDTH_PT + gutterMarginPt : outerMarginPt;
    const slotOriginY = outerMarginPt;

    // Horizontal alignment
    const alignment = imposition.options.alignment || 'center';
    let posX = slotOriginX + (slotWidth - scaledWidth) / 2;

    if (alignment === 'spine') {
      posX = isRightSlot ? slotOriginX : slotOriginX + (slotWidth - scaledWidth);
    } else if (alignment === 'outer') {
      posX = isRightSlot ? slotOriginX + (slotWidth - scaledWidth) : slotOriginX;
    }

    // Vertical alignment (centered within slot)
    const posY = slotOriginY + (slotHeight - scaledHeight) / 2;

    if (item.type === 'image') {
      targetPage.drawImage(item.drawable, {
        x: posX,
        y: posY,
        width: scaledWidth,
        height: scaledHeight,
      });
    } else {
      targetPage.drawPage(item.drawable, {
        x: posX,
        y: posY,
        xScale: scale,
        yScale: scale,
      });
    }
  };

  const drawFoldGuides = (targetPage: ReturnType<typeof outDoc.addPage>) => {
    if (!imposition.options.showFoldLine) return;

    const spineX = A4_HALF_WIDTH_PT;
    const guideColor = rgb(0.75, 0.75, 0.78);

    // Top tick mark
    targetPage.drawLine({
      start: { x: spineX, y: A4_HEIGHT_PT },
      end: { x: spineX, y: A4_HEIGHT_PT - 8 },
      thickness: 0.5,
      color: guideColor,
    });

    // Bottom tick mark
    targetPage.drawLine({
      start: { x: spineX, y: 0 },
      end: { x: spineX, y: 8 },
      thickness: 0.5,
      color: guideColor,
    });

    // Center dashed spine line
    targetPage.drawLine({
      start: { x: spineX, y: 12 },
      end: { x: spineX, y: A4_HEIGHT_PT - 12 },
      thickness: 0.35,
      color: rgb(0.85, 0.85, 0.88),
      dashArray: [3, 4],
    });
  };

  let sheetIdx = 0;
  const totalSheets = imposition.sheets.length;
  for (const sheet of imposition.sheets) {
    sheetIdx++;
    const currentPercent = Math.min(92, Math.round(((sheetIdx - 0.5) / totalSheets) * 90));
    if (exportOptions.onProgress) {
      exportOptions.onProgress(
        `Menyusun lembar ${sheetIdx} dari ${totalSheets}...`,
        currentPercent
      );
    }

    const shouldAddFront = exportOptions.mode === 'all' || exportOptions.mode === 'odd-only';
    const shouldAddBack = exportOptions.mode === 'all' || exportOptions.mode === 'even-only';

    // 1. Sisi Depan (Muka)
    if (shouldAddFront) {
      const frontPage = outDoc.addPage([A4_WIDTH_PT, A4_HEIGHT_PT]);
      await drawPageInSlot(frontPage, sheet.front.leftPage, false);
      await drawPageInSlot(frontPage, sheet.front.rightPage, true);
      drawFoldGuides(frontPage);
    }

    // 2. Sisi Belakang
    if (shouldAddBack) {
      const backPage = outDoc.addPage([A4_WIDTH_PT, A4_HEIGHT_PT]);
      await drawPageInSlot(backPage, sheet.back.leftPage, false);
      await drawPageInSlot(backPage, sheet.back.rightPage, true);
      drawFoldGuides(backPage);
    }
  }

  // Set standard PDF metadata
  outDoc.setTitle(`Booklet - ${imposition.metadata.filename}`);
  outDoc.setProducer('Katern PDF Booklet Converter (Client-side)');

  if (exportOptions.onProgress) {
    exportOptions.onProgress('Mengompresi struktur berkas PDF...', 95);
  }

  // Save with Object Streams compression unless 'none' is chosen
  const useObjectStreams = compressionLevel !== 'none';
  const savedPdfBytes = await outDoc.save({ useObjectStreams });

  if (exportOptions.onProgress) {
    exportOptions.onProgress('Selesai membuat berkas booklet!', 100);
  }

  return savedPdfBytes;
}
