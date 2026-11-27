import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { SheetViewer } from '../SheetViewer';
import { calculateImposition } from '../../utils/imposition';
import { BookletOptions, DocumentMetadata } from '../../types/booklet';
import * as pdfRenderer from '../../utils/pdfRenderer';

vi.mock('../../utils/pdfRenderer', () => ({
  renderPageThumbnail: vi.fn().mockResolvedValue('data:image/png;base64,stub'),
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
}));

const defaultOptions: BookletOptions = {
  blankPlacement: 'end',
  outerMarginMm: 5,
  gutterMarginMm: 4,
  marginMm: 5,
  showFoldLine: true,
  scaleMode: 'fit',
  alignment: 'center',
  sourceDimensionPreset: 'auto',
  customSourceWidthMm: 148,
  customSourceHeightMm: 210,
  compressionLevel: 'standard',
  autoCropWhiteMargins: false,
  cropPaddingMm: 3,
  cropThreshold: 245,
};

const baseMetadata: DocumentMetadata = {
  filename: 'buku-uji.pdf',
  fileSizeBytes: 120_000,
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
};

describe('SheetViewer', () => {
  const scrollToMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // jsdom does not implement Element.prototype.scrollTo
    Element.prototype.scrollTo = scrollToMock;
  });

  afterEach(() => {
    cleanup();
  });

  const createImposition = (overrideOptions?: Partial<BookletOptions>) =>
    calculateImposition(8, { ...defaultOptions, ...overrideOptions }, baseMetadata);

  it('switches to side-by-side mode and displays front and back A4 sheets separately', () => {
    const imposition = createImposition();
    render(<SheetViewer imposition={imposition} pdfDocument={null} />);

    // Default mode is single sheet (front only)
    expect(screen.getByTestId('a4-sheet-front')).toBeTruthy();
    expect(screen.queryByTestId('a4-sheet-back')).toBeNull();

    // Switch to side-by-side mode
    fireEvent.click(screen.getByRole('button', { name: /Berdampingan/i }));

    expect(screen.getByTestId('side-by-side-viewer')).toBeTruthy();
    expect(screen.getByTestId('a4-sheet-front')).toBeTruthy();
    expect(screen.getByTestId('a4-sheet-back')).toBeTruthy();
    expect(screen.getByText('Sisi Depan (Ganjil)')).toBeTruthy();
    expect(screen.getByText('Sisi Belakang (Genap)')).toBeTruthy();
  });

  it('controls zoom level accurately between 50% and 250% with presets and reset', () => {
    const imposition = createImposition();
    render(<SheetViewer imposition={imposition} pdfDocument={null} />);

    fireEvent.click(screen.getByRole('button', { name: /Berdampingan/i }));

    const readout = screen.getByTestId('zoom-level-readout');
    const zoomInBtn = screen.getByLabelText('Perbesar pratinjau');
    const zoomOutBtn = screen.getByLabelText('Perkecil pratinjau');

    expect(readout.textContent).toBe('100%');

    // Step up to max (250%)
    for (let i = 0; i < 8; i++) {
      fireEvent.click(zoomInBtn);
    }
    expect(readout.textContent).toBe('250%');
    expect((zoomInBtn as HTMLButtonElement).disabled).toBe(true);

    // Reset via reset button
    const resetBtn = screen.getByLabelText('Reset zoom ke 100%');
    fireEvent.click(resetBtn);
    expect(readout.textContent).toBe('100%');

    // Step down to min (50%)
    for (let i = 0; i < 4; i++) {
      fireEvent.click(zoomOutBtn);
    }
    expect(readout.textContent).toBe('50%');
    expect((zoomOutBtn as HTMLButtonElement).disabled).toBe(true);

    // Use side-by-side preset 200%
    fireEvent.click(screen.getByRole('button', { name: '200%' }));
    expect(readout.textContent).toBe('200%');

    // Click readout itself to reset to 100%
    fireEvent.click(readout);
    expect(readout.textContent).toBe('100%');
  });

  it('shows Fokus Lipatan button when zoomed above 100% and scrolls both sheets in side-by-side mode', () => {
    const imposition = createImposition();
    render(<SheetViewer imposition={imposition} pdfDocument={null} />);

    fireEvent.click(screen.getByRole('button', { name: /Berdampingan/i }));

    // Hidden at 100%
    expect(screen.queryByRole('button', { name: /Fokus Lipatan/i })).toBeNull();

    // Zoom to 150%
    fireEvent.click(screen.getByRole('button', { name: '150%' }));

    const focusFoldBtn = screen.getByRole('button', { name: /Fokus Lipatan/i });
    expect(focusFoldBtn).toBeTruthy();

    fireEvent.click(focusFoldBtn);
    // Called once for front viewport and once for back viewport
    expect(scrollToMock).toHaveBeenCalledTimes(2);
    expect(scrollToMock).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: 'smooth' })
    );
  });

  it('toggles fold and margin guides with Panduan Lipat button', () => {
    const imposition = createImposition({ gutterMarginMm: 4 });
    render(<SheetViewer imposition={imposition} pdfDocument={null} />);

    const guideBtn = screen.getByRole('button', { name: /Panduan Lipat/i });
    expect(guideBtn.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('LIPAT · 4mm')).toBeTruthy();

    fireEvent.click(guideBtn);
    expect(guideBtn.getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByText('LIPAT · 4mm')).toBeNull();
  });

  it('requests higher-resolution thumbnails when zoomed beyond 125%', async () => {
    const imposition = createImposition();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockPdfDoc = { numPages: 8 } as any;

    render(<SheetViewer imposition={imposition} pdfDocument={mockPdfDoc} />);

    await waitFor(() => {
      expect(pdfRenderer.renderPageThumbnail).toHaveBeenCalledWith(mockPdfDoc, 1, 440, undefined);
    });

    // Zoom in twice (100% -> 125% -> 150%)
    const zoomInBtn = screen.getByLabelText('Perbesar pratinjau');
    fireEvent.click(zoomInBtn);
    fireEvent.click(zoomInBtn);

    await waitFor(() => {
      expect(pdfRenderer.renderPageThumbnail).toHaveBeenCalledWith(mockPdfDoc, 1, 880, undefined);
    });
  });

  it('navigates sheets and switches to Mode Baca cleanly', () => {
    const imposition = createImposition();
    render(<SheetViewer imposition={imposition} pdfDocument={null} />);

    expect(screen.getByText('Lembar 1 dari 2')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Berikutnya/i }));
    expect(screen.getByText('Lembar 2 dari 2')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Mode Baca/i }));
    expect(screen.getByText('Simulasi Buku Saku')).toBeTruthy();
    expect(screen.getByText('Sampul Depan (Buku Tertutup)')).toBeTruthy();
  });
});
