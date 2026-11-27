import { describe, it, expect, vi } from 'vitest';
import { generateBookletPdf, A4_WIDTH_PT, A4_HEIGHT_PT, A4_HALF_WIDTH_PT } from '../pdfGenerator';
import { calculateImposition } from '../imposition';
import { BookletOptions } from '../../types/booklet';
import { createSampleA5Pdf } from '../samplePdf';
import { PDFDocument } from 'pdf-lib';

vi.mock('pdfjs-dist', () => {
  return {
    getDocument: vi.fn().mockImplementation(() => ({
      promise: Promise.reject(new Error('Network error loading pdfjs')),
    })),
  };
});


async function createValidMultiPagePdf(count: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < count; i++) {
    const page = doc.addPage([420.95, 595.28]);
    page.drawText(`Halaman Uji ${i + 1}`, { x: 50, y: 50, size: 12 });
  }
  return doc.save();
}

describe('pdfGenerator', () => {
  const defaultOptions: BookletOptions = {
    gutterMarginMm: 5,
    outerMarginMm: 10,
    marginMm: 10,
    showFoldLine: true,
    scaleMode: 'fit',
    alignment: 'center',
    sourceDimensionPreset: 'a5',
    customSourceWidthMm: 148,
    customSourceHeightMm: 210,
    compressionLevel: 'none',
    autoCropWhiteMargins: false,
    cropPaddingMm: 3,
    cropThreshold: 245,
    blankPlacement: 'end',
  };

  it('exports valid standard A4 landscape dimension constants', () => {
    expect(A4_WIDTH_PT).toBeCloseTo(841.89, 1);
    expect(A4_HEIGHT_PT).toBeCloseTo(595.28, 1);
    expect(A4_HALF_WIDTH_PT).toBeCloseTo(420.945, 1);
  });

  it('generates a complete 2-Up A4 landscape booklet for an 8-page PDF document', async () => {
    const sampleBytes = await createSampleA5Pdf();
    const imposition = calculateImposition(8, defaultOptions);

    const progressCalls: string[] = [];
    const generatedPdfBytes = await generateBookletPdf(sampleBytes, imposition, {
      mode: 'all',
      onProgress: (status) => progressCalls.push(status),
    });

    expect(generatedPdfBytes).toBeInstanceOf(Uint8Array);
    expect(generatedPdfBytes.length).toBeGreaterThan(1000);
    expect(progressCalls.length).toBeGreaterThan(0);

    // Validate generated PDF structure using pdf-lib
    const loadedDoc = await PDFDocument.load(generatedPdfBytes);
    // 8 pages = 2 sheets = 4 output sides (2 front + 2 back)
    expect(loadedDoc.getPageCount()).toBe(4);

    const firstPage = loadedDoc.getPage(0);
    expect(firstPage.getWidth()).toBeCloseTo(A4_WIDTH_PT, 1);
    expect(firstPage.getHeight()).toBeCloseTo(A4_HEIGHT_PT, 1);
  });

  it('supports odd-only mode (front sides) for manual duplex printers', async () => {
    const sampleBytes = await createSampleA5Pdf();
    const imposition = calculateImposition(8, defaultOptions);

    const generatedPdfBytes = await generateBookletPdf(sampleBytes, imposition, {
      mode: 'odd-only',
    });

    const loadedDoc = await PDFDocument.load(generatedPdfBytes);
    // Only 2 front sides
    expect(loadedDoc.getPageCount()).toBe(2);
  });

  it('supports even-only mode (back sides) for manual duplex printers', async () => {
    const sampleBytes = await createSampleA5Pdf();
    const imposition = calculateImposition(8, defaultOptions);

    const generatedPdfBytes = await generateBookletPdf(sampleBytes, imposition, {
      mode: 'even-only',
    });

    const loadedDoc = await PDFDocument.load(generatedPdfBytes);
    // Only 2 back sides
    expect(loadedDoc.getPageCount()).toBe(2);
  });

  it('supports spine and outer alignment modes', async () => {
    const sampleBytes = await createSampleA5Pdf();

    // Test spine alignment
    const spineOptions: BookletOptions = {
      ...defaultOptions,
      alignment: 'spine',
      showFoldLine: false,
    };
    const impositionSpine = calculateImposition(4, spineOptions);
    const spinePdf = await generateBookletPdf(sampleBytes, impositionSpine, { mode: 'all' });
    expect(spinePdf).toBeDefined();

    // Test outer alignment
    const outerOptions: BookletOptions = {
      ...defaultOptions,
      alignment: 'outer',
      scaleMode: 'actual',
    };
    const impositionOuter = calculateImposition(4, outerOptions);
    const outerPdf = await generateBookletPdf(sampleBytes, impositionOuter, { mode: 'all' });
    expect(outerPdf).toBeDefined();
  });

  it('handles blank pages correctly when original page count is not a multiple of 4', async () => {
    // 5-page document -> padded to 8 pages (3 blank pages)
    const fivePagePdfBytes = await createValidMultiPagePdf(5);
    const imposition = calculateImposition(5, defaultOptions);

    const generatedPdfBytes = await generateBookletPdf(fivePagePdfBytes, imposition, {
      mode: 'all',
    });

    const loadedDoc = await PDFDocument.load(generatedPdfBytes);
    expect(loadedDoc.getPageCount()).toBe(4); // 2 sheets = 4 sides
  });

  it('supports vector auto-crop embedding when autoCropWhiteMargins is enabled', async () => {
    const fourPageBytes = await createValidMultiPagePdf(4);


    const cropOptions: BookletOptions = {
      ...defaultOptions,
      autoCropWhiteMargins: true,
      compressionLevel: 'none',
    };
    const imposition = calculateImposition(4, cropOptions);

    const autoCropModule = await import('../autoCrop');
    vi.spyOn(autoCropModule, 'detectPageCropBox').mockResolvedValue({
      hasCropped: true,
      x: 15,
      y: 20,
      width: 390,
      height: 555,
      originalWidth: 420.95,
      originalHeight: 595.28,
    });


    const mockPdfjsDoc = {
      getPage: vi.fn().mockResolvedValue({
        getViewport: vi.fn().mockReturnValue({ width: 420.95, height: 595.28 }),
      }),
    };

    const generatedPdfBytes = await generateBookletPdf(fourPageBytes, imposition, {
      mode: 'all',
      pdfjsDoc: mockPdfjsDoc,
    });

    expect(generatedPdfBytes).toBeInstanceOf(Uint8Array);
    const loadedDoc = await PDFDocument.load(generatedPdfBytes);
    expect(loadedDoc.getPageCount()).toBe(2);
  });

  it('supports image optimization with offscreen rasterization and cropped canvas', async () => {
    const fourPageBytes = await createValidMultiPagePdf(4);

    const compactOptions: BookletOptions = {
      ...defaultOptions,
      compressionLevel: 'compact',
      autoCropWhiteMargins: true,
    };
    const imposition = calculateImposition(4, compactOptions);

    // Minimal valid 1x1 JPEG byte stream
    const minimalJpgBytes = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
      0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
      0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
      0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20,
      0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27,
      0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
      0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01,
      0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04,
      0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
      0x00, 0xbf, 0x80, 0xff, 0xd9,
    ]);

    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    const originalToBlob = HTMLCanvasElement.prototype.toBlob;

    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      fillStyle: '#FFFFFF',
      fillRect: vi.fn(),
      drawImage: vi.fn(),
    } as any);

    HTMLCanvasElement.prototype.toBlob = vi.fn().mockImplementation((cb: (b: Blob | null) => void) => {
      cb(new Blob([minimalJpgBytes], { type: 'image/jpeg' }));
    });

    const autoCropModule = await import('../autoCrop');
    vi.spyOn(autoCropModule, 'detectPageCropBox').mockResolvedValue({
      hasCropped: true,
      x: 10,
      y: 10,
      width: 400,
      height: 575,
      originalWidth: 420.95,
      originalHeight: 595.28,
    });


    const mockPdfjsDoc = {
      getPage: vi.fn().mockResolvedValue({
        getViewport: vi.fn().mockReturnValue({ width: 420.95, height: 595.28 }),
        render: vi.fn().mockReturnValue({ promise: Promise.resolve() }),
      }),
    };

    const generatedPdfBytes = await generateBookletPdf(fourPageBytes, imposition, {
      mode: 'all',
      pdfjsDoc: mockPdfjsDoc,
    });

    expect(generatedPdfBytes).toBeInstanceOf(Uint8Array);

    HTMLCanvasElement.prototype.getContext = originalGetContext;
    HTMLCanvasElement.prototype.toBlob = originalToBlob;
  });

  it('gracefully falls back to vector embedding if rasterization fails', async () => {
    const fourPageBytes = await createValidMultiPagePdf(4);

    const balancedOptions: BookletOptions = {
      ...defaultOptions,
      compressionLevel: 'balanced',
    };
    const imposition = calculateImposition(4, balancedOptions);

    const mockPdfjsDoc = {
      getPage: vi.fn().mockRejectedValue(new Error('Canvas rasterization error')),
    };

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const generatedPdfBytes = await generateBookletPdf(fourPageBytes, imposition, {
      mode: 'all',
      pdfjsDoc: mockPdfjsDoc,
    });

    expect(generatedPdfBytes).toBeInstanceOf(Uint8Array);
    expect(consoleWarnSpy).toHaveBeenCalled();
    consoleWarnSpy.mockRestore();
  });

  it('handles automatic pdfjsDoc loading failure without throwing', async () => {
    const fourPageBytes = await createValidMultiPagePdf(4);

    const balancedOptions: BookletOptions = {
      ...defaultOptions,
      compressionLevel: 'balanced',
    };
    const imposition = calculateImposition(4, balancedOptions);

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const generatedPdfBytes = await generateBookletPdf(fourPageBytes, imposition, {
      mode: 'all',
      // pdfjsDoc is omitted so it attempts to load via pdfjsLib.getDocument (which rejects via module mock)
    });

    expect(generatedPdfBytes).toBeInstanceOf(Uint8Array);
    expect(consoleWarnSpy).toHaveBeenCalled();
    consoleWarnSpy.mockRestore();
  });
});


