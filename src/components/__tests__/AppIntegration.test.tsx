import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import App from '../../App';
import { ThemeProvider } from '../../context/ThemeContext';
import { ToastProvider } from '../../context/ToastContext';

vi.mock('../../utils/samplePdf', () => ({
  createSampleA5Pdf: vi.fn().mockResolvedValue(new ArrayBuffer(64)),
}));

vi.mock('../../utils/pdfRenderer', () => ({
  loadPdfFromFile: vi.fn(),
  loadPdfFromArrayBuffer: vi.fn().mockResolvedValue({
    arrayBuffer: new ArrayBuffer(64),
    pdfDocument: { numPages: 8 },
    metadata: {
      filename: 'Contoh-Booklet-A5-1.pdf',
      fileSizeBytes: 64,
      originalPageCount: 8,
      paddedPageCount: 8,
      blankPagesAdded: 0,
      totalSheets: 2,
      pageWidthPt: 419.53,
      pageHeightPt: 595.28,
      isA5Estimated: true,
      dimensionsDescription: 'A5 Portrait (148 × 210 mm)',
      detectedWidthMm: 148,
      detectedHeightMm: 210,
    },
  }),
  renderPageThumbnail: vi.fn().mockResolvedValue('data:image/png;base64,stub'),
  clearThumbnailCache: vi.fn(),
}));

vi.mock('../../utils/autoCrop', () => ({
  detectPageCropBox: vi.fn().mockResolvedValue({
    x: 0,
    y: 0,
    width: 420,
    height: 595,
    originalWidth: 420,
    originalHeight: 595,
    hasCropped: false,
  }),
  clearCropCache: vi.fn(),
}));

describe('App Integration Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('loads the sample PDF booklet, previews sheets side-by-side and in 3D without errors', async () => {
    render(
      <ThemeProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </ThemeProvider>
    );

    const sampleBtn = screen.getByRole('button', { name: /Muat Contoh A5/i });
    fireEvent.click(sampleBtn);

    await waitFor(() => {
      expect(screen.getByText('Pratinjau Imposisi Booklet')).toBeTruthy();
    });

    // Switch to Side-by-Side view
    fireEvent.click(screen.getByRole('button', { name: /Berdampingan/i }));
    expect(screen.getByTestId('side-by-side-viewer')).toBeTruthy();

    // Switch to 3D Preview (Flipbook 3D -> Studio 3D Lengkap)
    fireEvent.click(screen.getByRole('button', { name: /Pratinjau 3D/i }));
    expect(screen.getByTestId('flipbook-3d-viewer')).toBeTruthy();

    fireEvent.click(screen.getByTestId('btn-3d-studio'));
    expect(screen.getByTestId('interactive-3d-viewer')).toBeTruthy();
  });
});
