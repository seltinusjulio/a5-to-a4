import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearCropCache, detectPageCropBox } from '../autoCrop';

describe('autoCrop utility', () => {
  beforeEach(() => {
    clearCropCache();
    vi.restoreAllMocks();
  });

  it('clears crop cache without error', () => {
    expect(() => clearCropCache()).not.toThrow();
  });

  it('returns fallback crop box when canvas context is unavailable', async () => {
    const mockPage = {
      getViewport: vi.fn().mockReturnValue({ width: 595, height: 842 }),
      render: vi.fn(),
    };

    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(null);

    const result = await detectPageCropBox(mockPage, 'doc-fallback', 1, 3);

    expect(result).toBeDefined();
    expect(result.width).toBe(595);
    expect(result.height).toBe(842);
    expect(result.hasCropped).toBe(false);

    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });

  it('detects blank page when all pixels are white', async () => {
    const width = 100;
    const height = 100;
    const pixels = new Uint8ClampedArray(width * height * 4);
    // Fill all with pure white (255)
    pixels.fill(255);

    const mockCtx = {
      fillStyle: '#FFFFFF',
      fillRect: vi.fn(),
      getImageData: vi.fn().mockReturnValue({ data: pixels }),
    };

    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(mockCtx as any);

    const mockPage = {
      getViewport: vi.fn().mockReturnValue({ width, height }),
      render: vi.fn().mockReturnValue({ promise: Promise.resolve() }),
    };

    const result = await detectPageCropBox(mockPage, 'doc-blank', 1, 3);
    expect(result.hasCropped).toBe(false);
    expect(result.width).toBe(width);

    // Call again to verify memory cache hits
    const cachedResult = await detectPageCropBox(mockPage, 'doc-blank', 1, 3);
    expect(cachedResult).toBe(result);

    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });

  it('calculates cropped bounding box when content with margins is present', async () => {
    const width = 200;
    const height = 200;
    const pixels = new Uint8ClampedArray(width * height * 4);
    pixels.fill(255); // Start with white

    // Add black block in center (x: 50..100, y: 50..100)
    for (let y = 50; y < 100; y++) {
      for (let x = 50; x < 100; x++) {
        const idx = (y * width + x) * 4;
        pixels[idx] = 0; // R
        pixels[idx + 1] = 0; // G
        pixels[idx + 2] = 0; // B
        pixels[idx + 3] = 255;
      }
    }

    const mockCtx = {
      fillStyle: '#FFFFFF',
      fillRect: vi.fn(),
      getImageData: vi.fn().mockReturnValue({ data: pixels }),
    };

    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(mockCtx as any);

    const mockPage = {
      getViewport: vi.fn().mockReturnValue({ width, height }),
      render: vi.fn().mockReturnValue({ promise: Promise.resolve() }),
    };

    const result = await detectPageCropBox(mockPage, 'doc-cropped', 1, 2);
    expect(result.hasCropped).toBe(true);
    expect(result.width).toBeLessThan(width);
    expect(result.height).toBeLessThan(height);

    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });

  it('does not crop when content already occupies more than 94% of page area', async () => {
    const width = 200;
    const height = 200;
    const pixels = new Uint8ClampedArray(width * height * 4);
    pixels.fill(255);

    // Dark pixels spanning across from x=4 to x=196, y=4 to y=196 (>94%)
    for (let y = 4; y < 196; y += 2) {
      for (let x = 4; x < 196; x += 2) {
        const idx = (y * width + x) * 4;
        pixels[idx] = 20;
        pixels[idx + 1] = 20;
        pixels[idx + 2] = 20;
        pixels[idx + 3] = 255;
      }
    }

    const mockCtx = {
      fillStyle: '#FFFFFF',
      fillRect: vi.fn(),
      getImageData: vi.fn().mockReturnValue({ data: pixels }),
    };

    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(mockCtx as any);

    const mockPage = {
      getViewport: vi.fn().mockReturnValue({ width, height }),
      render: vi.fn().mockReturnValue({ promise: Promise.resolve() }),
    };

    const result = await detectPageCropBox(mockPage, 'doc-full', 1, 3);
    expect(result.hasCropped).toBe(false);

    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });

  it('handles render exceptions gracefully and returns fallback', async () => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      fillStyle: '#FFFFFF',
      fillRect: vi.fn(),
      getImageData: vi.fn(),
    } as any);

    const mockPage = {
      getViewport: vi.fn().mockReturnValue({ width: 300, height: 400 }),
      render: vi.fn().mockReturnValue({ promise: Promise.reject(new Error('Canvas render failed')) }),
    };

    const result = await detectPageCropBox(mockPage, 'doc-error', 1, 3);
    expect(result.hasCropped).toBe(false);
    expect(result.width).toBe(300);

    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });
});
