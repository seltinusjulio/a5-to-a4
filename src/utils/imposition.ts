import {
  BookletOptions,
  DocumentMetadata,
  ImpositionPageInfo,
  ImpositionResult,
  SheetInfo,
  SheetSideInfo,
} from '../types/booklet';

/**
 * Calculates the imposition layout for a saddle-stitch booklet.
 */
export function calculateImposition(
  originalCount: number,
  options: BookletOptions,
  rawMetadata?: Partial<DocumentMetadata>
): ImpositionResult {
  // Padded count is nearest multiple of 4
  const paddedPageCount = Math.max(4, Math.ceil(originalCount / 4) * 4);
  const blankPagesAdded = paddedPageCount - originalCount;
  const totalSheets = paddedPageCount / 4;

  // Build the virtual sequence of length M (1..paddedPageCount)
  // Each entry maps to an original page index (1..originalCount) or null (blank)
  const sequence: (number | null)[] = new Array(paddedPageCount).fill(null);

  if (options.blankPlacement === 'before-back-cover' && blankPagesAdded > 0 && originalCount >= 2) {
    // Pages 1 to originalCount - 1 go into indices 0 to originalCount - 2
    for (let i = 0; i < originalCount - 1; i++) {
      sequence[i] = i + 1;
    }
    // Blank pages are in between
    // The very last slot (paddedPageCount - 1) gets the original back cover (originalCount)
    sequence[paddedPageCount - 1] = originalCount;
  } else {
    // Default 'end': Original pages first, blank pages at the end
    for (let i = 0; i < originalCount; i++) {
      sequence[i] = i + 1;
    }
  }

  const createPageInfo = (virtualIdx1: number): ImpositionPageInfo => {
    const originalNum = sequence[virtualIdx1 - 1];
    const isBlank = originalNum === null;
    const isCover = originalNum === 1;
    const isBackCover = originalNum === originalCount && originalCount > 1;

    let label = '';
    if (isBlank) {
      label = 'Halaman Kosong';
    } else if (isCover) {
      label = `Hal ${originalNum} (Sampul Depan)`;
    } else if (isBackCover) {
      label = `Hal ${originalNum} (Sampul Belakang)`;
    } else {
      label = `Halaman ${originalNum}`;
    }

    return {
      pageNumber: originalNum,
      virtualIndex: virtualIdx1,
      label,
      isCover,
      isBackCover,
      isBlank,
    };
  };

  const sheets: SheetInfo[] = [];

  for (let s = 1; s <= totalSheets; s++) {
    // Front side (Output PDF Page: 2s - 1)
    // Left: M - 2(s - 1)
    // Right: 2s - 1
    const frontLeftVirtual = paddedPageCount - 2 * (s - 1);
    const frontRightVirtual = 2 * (s - 1) + 1;

    const frontSide: SheetSideInfo = {
      sheetNumber: s,
      side: 'front',
      sideName: 'Sisi Depan (Muka)',
      outputPdfPageIndex: 2 * s - 1,
      leftPage: createPageInfo(frontLeftVirtual),
      rightPage: createPageInfo(frontRightVirtual),
    };

    // Back side (Output PDF Page: 2s)
    // Left: 2s
    // Right: M - 2s + 1
    const backLeftVirtual = 2 * s;
    const backRightVirtual = paddedPageCount - 2 * s + 1;

    const backSide: SheetSideInfo = {
      sheetNumber: s,
      side: 'back',
      sideName: 'Sisi Belakang',
      outputPdfPageIndex: 2 * s,
      leftPage: createPageInfo(backLeftVirtual),
      rightPage: createPageInfo(backRightVirtual),
    };

    sheets.push({
      sheetNumber: s,
      front: frontSide,
      back: backSide,
    });
  }

  const metadata: DocumentMetadata = {
    filename: rawMetadata?.filename || 'dokumen.pdf',
    fileSizeBytes: rawMetadata?.fileSizeBytes || 0,
    originalPageCount: originalCount,
    paddedPageCount,
    blankPagesAdded,
    totalSheets,
    pageWidthPt: rawMetadata?.pageWidthPt || 420.95,
    pageHeightPt: rawMetadata?.pageHeightPt || 595.28,
    isA5Estimated: rawMetadata?.isA5Estimated ?? true,
    dimensionsDescription: rawMetadata?.dimensionsDescription || 'A5 (148 × 210 mm)',
    detectedWidthMm: rawMetadata?.detectedWidthMm || Math.round(((rawMetadata?.pageWidthPt || 420.95) * 25.4) / 72),
    detectedHeightMm: rawMetadata?.detectedHeightMm || Math.round(((rawMetadata?.pageHeightPt || 595.28) * 25.4) / 72),
  };

  return {
    metadata,
    sheets,
    options,
  };
}
