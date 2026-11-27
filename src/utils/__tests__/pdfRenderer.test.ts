import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as pdfjsLib from 'pdfjs-dist';
import { clearThumbnailCache, renderPageThumbnail, loadPdfDocument, loadPdfFromArrayBuffer } from '../pdfRenderer';

vi.mock('pdfjs-dist', () => {
  return {
    GlobalWorkerOptions: { workerSrc: '' },
    getDocument: vi.fn(),
  };
});

describe('pdfRenderer', () => {
  beforeEach(() => {
    clearThumbnailCache();
    vi.restoreAllMocks();
  });

  it('clears thumbnail cache without throwing error', () => {
    expect(() => clearThumbnailCache()).not.toThrow();
  });

  it('renders thumbnail to data URL with canvas context and caches output', async () => {
    const mockViewport = { width: 150, height: 210 };
    const mockPage = {
      getViewport: vi.fn().mockReturnValue(mockViewport),
      render: vi.fn().mockReturnValue({ promise: Promise.resolve() }),
    };
    const mockPdfDoc = {
      fingerprints: ['mock-fingerprint-1'],
      getPage: vi.fn().mockResolvedValue(mockPage),
    };

    const mockCtx = {
      fillStyle: '#FFFFFF',
      fillRect: vi.fn(),
      drawImage: vi.fn(),
    };

    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;

    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(mockCtx as any);
    HTMLCanvasElement.prototype.toDataURL = vi.fn().mockReturnValue('data:image/jpeg;base64,mockthumb');

    const thumbUrl = await renderPageThumbnail(mockPdfDoc as any, 1, 300);
    expect(thumbUrl).toBe('data:image/jpeg;base64,mockthumb');
    expect(mockPdfDoc.getPage).toHaveBeenCalledWith(1);

    // Call again to verify cache
    const cachedThumb = await renderPageThumbnail(mockPdfDoc as any, 1, 300);
    expect(cachedThumb).toBe(thumbUrl);

    HTMLCanvasElement.prototype.getContext = originalGetContext;
    HTMLCanvasElement.prototype.toDataURL = originalToDataURL;
  });

  it('handles render errors gracefully and returns empty string', async () => {
    const mockPdfDoc = {
      fingerprints: ['mock-fingerprint-err'],
      getPage: vi.fn().mockRejectedValue(new Error('Page not found')),
    };

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await renderPageThumbnail(mockPdfDoc as any, 999, 300);
    expect(result).toBe('');
    consoleSpy.mockRestore();
  });

  it('handles null canvas 2D context gracefully and returns empty string', async () => {
    const mockViewport = { width: 150, height: 210 };
    const mockPage = {
      getViewport: vi.fn().mockReturnValue(mockViewport),
      render: vi.fn().mockReturnValue({ promise: Promise.resolve() }),
    };
    const mockPdfDoc = {
      fingerprints: ['mock-fingerprint-nullctx'],
      getPage: vi.fn().mockResolvedValue(mockPage),
    };

    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(null);

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await renderPageThumbnail(mockPdfDoc as any, 1, 300);
    expect(result).toBe('');
    consoleSpy.mockRestore();

    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });

  it('renders cropped thumbnail when cropBox hasCropped is true', async () => {
    const mockViewport = { width: 150, height: 210 };
    const mockPage = {
      getViewport: vi.fn().mockReturnValue(mockViewport),
      render: vi.fn().mockReturnValue({ promise: Promise.resolve() }),
    };
    const mockPdfDoc = {
      fingerprints: ['mock-fingerprint-crop'],
      getPage: vi.fn().mockResolvedValue(mockPage),
    };

    const mockCtx = {
      fillStyle: '#FFFFFF',
      fillRect: vi.fn(),
      drawImage: vi.fn(),
    };

    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;

    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(mockCtx as any);
    HTMLCanvasElement.prototype.toDataURL = vi.fn().mockReturnValue('data:image/jpeg;base64,croppedthumb');

    const cropBox = {
      hasCropped: true,
      x: 10,
      y: 15,
      width: 100,
      height: 140,
      originalWidth: 150,
      originalHeight: 210,
    };


    const thumbUrl = await renderPageThumbnail(mockPdfDoc as any, 1, 300, cropBox);
    expect(thumbUrl).toBe('data:image/jpeg;base64,croppedthumb');
    expect(mockCtx.drawImage).toHaveBeenCalled();

    HTMLCanvasElement.prototype.getContext = originalGetContext;
    HTMLCanvasElement.prototype.toDataURL = originalToDataURL;
  });

  it('loads PDF file via loadPdfDocument and accurately detects A5 portrait dimensions', async () => {
    const mockPage = {
      getViewport: vi.fn().mockReturnValue({ width: 420.95, height: 595.28 }),
    };
    const mockPdfDoc = {
      numPages: 6,
      getPage: vi.fn().mockResolvedValue(mockPage),
    };

    vi.mocked(pdfjsLib.getDocument).mockReturnValue({
      promise: Promise.resolve(mockPdfDoc as any),
    } as any);

    const dummyFile = new File(['dummy-content'], 'buku-test.pdf', { type: 'application/pdf' });
    const loaded = await loadPdfDocument(dummyFile);

    expect(pdfjsLib.getDocument).toHaveBeenCalled();
    expect(loaded.metadata.filename).toBe('buku-test.pdf');
    expect(loaded.metadata.originalPageCount).toBe(6);
    expect(loaded.metadata.paddedPageCount).toBe(8);
    expect(loaded.metadata.blankPagesAdded).toBe(2);
    expect(loaded.metadata.totalSheets).toBe(2);
    expect(loaded.metadata.isA5Estimated).toBe(true);
    expect(loaded.metadata.dimensionsDescription).toContain('A5 Potret');
  });

  it('loads non-A5 landscape PDF file via loadPdfDocument and formats landscape label', async () => {
    const mockPage = {
      getViewport: vi.fn().mockReturnValue({ width: 841.89, height: 595.28 }), // A4 landscape
    };
    const mockPdfDoc = {
      numPages: 3,
      getPage: vi.fn().mockResolvedValue(mockPage),
    };

    vi.mocked(pdfjsLib.getDocument).mockReturnValue({
      promise: Promise.resolve(mockPdfDoc as any),
    } as any);

    const dummyFile = new File(['dummy-content-landscape'], 'lanskap.pdf', { type: 'application/pdf' });
    const loaded = await loadPdfDocument(dummyFile);

    expect(loaded.metadata.isA5Estimated).toBe(false);
    expect(loaded.metadata.dimensionsDescription).toContain('Lanskap');
    expect(loaded.metadata.blankPagesAdded).toBe(1);
    expect(loaded.metadata.paddedPageCount).toBe(4);
  });

  it('loads PDF from ArrayBuffer via loadPdfFromArrayBuffer', async () => {
    const mockPage = {
      getViewport: vi.fn().mockReturnValue({ width: 420.95, height: 595.28 }),
    };
    const mockPdfDoc = {
      numPages: 4,
      getPage: vi.fn().mockResolvedValue(mockPage),
    };

    vi.mocked(pdfjsLib.getDocument).mockReturnValue({
      promise: Promise.resolve(mockPdfDoc as any),
    } as any);

    const dummyBuffer = new Uint8Array([1, 2, 3, 4, 5]).buffer;
    const loaded = await loadPdfFromArrayBuffer(dummyBuffer, 'contoh-buffer.pdf');

    expect(loaded.metadata.filename).toBe('contoh-buffer.pdf');
    expect(loaded.metadata.originalPageCount).toBe(4);
    expect(loaded.metadata.paddedPageCount).toBe(4);
    expect(loaded.metadata.blankPagesAdded).toBe(0);
    expect(loaded.metadata.totalSheets).toBe(1);
  });
});


