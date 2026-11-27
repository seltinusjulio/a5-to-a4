import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportBatchAsZip } from '../zipExport';
import { BatchItem, BookletOptions } from '../../types/booklet';
import { calculateImposition } from '../imposition';

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

describe('exportBatchAsZip', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.URL.createObjectURL = vi.fn().mockReturnValue('blob:http://localhost/test-uuid');
    global.URL.revokeObjectURL = vi.fn();
  });

  it('throws an error if no valid items are provided', async () => {
    const emptyItems: BatchItem[] = [];
    await expect(exportBatchAsZip(emptyItems)).rejects.toThrow('Tidak ada berkas yang siap untuk diunduh.');

    const invalidItems: BatchItem[] = [
      {
        id: '1',
        file: new File([], 'test.pdf'),
        filename: 'test.pdf',
        fileSizeBytes: 0,
        progress: 0,
        status: 'error',
        errorMessage: 'Invalid',
        loadedDoc: null,
        imposition: null,
        options: defaultOptions,
      },
    ];
    await expect(exportBatchAsZip(invalidItems)).rejects.toThrow('Tidak ada berkas yang siap untuk diunduh.');
  });

  it('compiles batch items into zip archive and triggers download', async () => {
    const dummyPdf = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55]); // %PDF-1.7
    const imposition = calculateImposition(4, defaultOptions);

    const items: BatchItem[] = [
      {
        id: 'item-1',
        file: new File([dummyPdf], 'modul.pdf', { type: 'application/pdf' }),
        filename: 'modul.pdf',
        fileSizeBytes: 120000,
        progress: 100,
        status: 'ready',
        errorMessage: null,
        options: defaultOptions,
        imposition,
        loadedDoc: {
          arrayBuffer: dummyPdf.buffer,
          pdfDocument: null as any,
          pageCount: 4,
          firstPageWidthPt: 420.95,
          firstPageHeightPt: 595.28,
          detectedPreset: 'a5',
        },
        generatedPdfBytes: dummyPdf,
      },
    ];

    const progressReports: any[] = [];
    const clickSpy = vi.fn();
    const originalCreateElement = document.createElement.bind(document);

    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = originalCreateElement(tagName);
      if (tagName.toLowerCase() === 'a') {
        el.click = clickSpy;
      }
      return el;
    });

    await exportBatchAsZip(items, (progress) => {
      progressReports.push(progress);
    });

    expect(clickSpy).toHaveBeenCalled();
    expect(progressReports.length).toBeGreaterThan(0);
    expect(global.URL.createObjectURL).toHaveBeenCalled();
  });

  it('generates booklet pdf on the fly when item.generatedPdfBytes is missing and cleans up URL after timeout', async () => {
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

    const sampleBytes = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55]); // %PDF-1.7
    const imposition = calculateImposition(4, defaultOptions);

    const items: BatchItem[] = [
      {
        id: 'item-lazy',
        file: new File([sampleBytes], 'dokumen-lazy.pdf', { type: 'application/pdf' }),
        filename: 'dokumen-lazy.pdf',
        fileSizeBytes: 50000,
        progress: 100,
        status: 'ready',
        errorMessage: null,
        options: defaultOptions,
        imposition,
        loadedDoc: {
          arrayBuffer: sampleBytes.buffer,
          pdfDocument: null as any,
          pageCount: 4,
          firstPageWidthPt: 420.95,
          firstPageHeightPt: 595.28,
          detectedPreset: 'a5',
        },
        generatedPdfBytes: undefined, // Missing, should trigger on-the-fly generation
      },
    ];

    const progressReports: any[] = [];
    const clickSpy = vi.fn();
    const originalCreateElement = document.createElement.bind(document);

    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = originalCreateElement(tagName);
      if (tagName.toLowerCase() === 'a') {
        el.click = clickSpy;
      }
      return el;
    });

    // Mock pdfGenerator module's generateBookletPdf
    const pdfGenerator = await import('../pdfGenerator');
    const generateSpy = vi.spyOn(pdfGenerator, 'generateBookletPdf').mockImplementation(
      async (_bytes, _imp, opts) => {
        if (opts?.onProgress) {
          opts.onProgress('Menyusun halaman 1...', 50);
        }
        return new Uint8Array([37, 80, 68, 70]);
      }
    );

    await exportBatchAsZip(items, (p) => progressReports.push(p));

    expect(generateSpy).toHaveBeenCalled();
    expect(items[0].generatedPdfBytes).toBeDefined();
    expect(clickSpy).toHaveBeenCalled();

    // Verify setTimeout was called with 10000ms delay and execute it
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 10000);
    const cleanupCall = setTimeoutSpy.mock.calls.find((call) => call[1] === 10000);
    expect(cleanupCall).toBeDefined();
    const callback = cleanupCall![0] as () => void;
    callback();

    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:http://localhost/test-uuid');
  });
});


