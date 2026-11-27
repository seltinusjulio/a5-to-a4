import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SheetViewer } from '../SheetViewer';
import { Flipbook3DViewer } from '../Flipbook3DViewer';
import { Interactive3DBookletViewer } from '../Interactive3DBookletViewer';
import { calculateImposition } from '../../utils/imposition';
import { BookletOptions, DocumentMetadata } from '../../types/booklet';

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
  filename: 'buku-3d.pdf',
  fileSizeBytes: 150_000,
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

describe('3D Print Preview Modes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const createImposition = () => calculateImposition(8, defaultOptions, baseMetadata);

  it('switches to Pratinjau 3D in SheetViewer and toggles between Flipbook 3D and Studio 3D Lengkap', () => {
    render(<SheetViewer imposition={createImposition()} pdfDocument={null} />);

    fireEvent.click(screen.getByRole('button', { name: /Pratinjau 3D/i }));

    expect(screen.getByTestId('preview-3d-panel')).toBeTruthy();
    // Defaults to lightweight Flipbook 3D
    expect(screen.getByTestId('flipbook-3d-viewer')).toBeTruthy();

    // Switch to full Interactive 3D Studio
    fireEvent.click(screen.getByTestId('btn-3d-studio'));
    expect(screen.getByTestId('interactive-3d-viewer')).toBeTruthy();

    // Switch back to Flipbook 3D
    fireEvent.click(screen.getByTestId('btn-3d-flipbook'));
    expect(screen.getByTestId('flipbook-3d-viewer')).toBeTruthy();
  });

  it('animates cover open/close, leaf flipping, and keyboard navigation in Flipbook3DViewer', () => {
    render(<Flipbook3DViewer imposition={createImposition()} pdfDocument={null} />);

    const status = screen.getByTestId('flipbook-status');
    expect(status.textContent).toBe('Sampul Depan (Tertutup)');
    expect(screen.getByTestId('flipbook-leaf-0').getAttribute('data-flipped')).toBe('false');

    // Open cover
    fireEvent.click(screen.getByRole('button', { name: /Buka Sampul/i }));
    expect(screen.getByTestId('flipbook-leaf-0').getAttribute('data-flipped')).toBe('true');
    expect(status.textContent).toContain('Hal 2 & Hal 3');

    // Flip next page via keyboard ArrowRight
    const stage = screen.getByTestId('flipbook-3d-viewer');
    fireEvent.keyDown(stage, { key: 'ArrowRight' });
    expect(screen.getByTestId('flipbook-leaf-1').getAttribute('data-flipped')).toBe('true');
    expect(status.textContent).toContain('Hal 4 & Hal 5');

    // Flip back via keyboard ArrowLeft
    fireEvent.keyDown(stage, { key: 'ArrowLeft' });
    expect(screen.getByTestId('flipbook-leaf-1').getAttribute('data-flipped')).toBe('false');

    // Jump to back cover
    fireEvent.click(screen.getByRole('button', { name: /Sampul Belakang/i }));
    expect(status.textContent).toBe('Sampul Belakang (Tertutup)');

    // Close back to front cover
    fireEvent.click(screen.getByRole('button', { name: /Tutup Depan/i }));
    expect(status.textContent).toBe('Sampul Depan (Tertutup)');
  });

  it('controls fold progress, exploded stack, page flipping, and collapsible dock in Interactive3DBookletViewer', () => {
    render(<Interactive3DBookletViewer imposition={createImposition()} pdfDocument={null} />);

    // In jsdom WebGL is unavailable, so fallback renders cleanly without crashing
    expect(screen.getByTestId('webgl-fallback')).toBeTruthy();
    expect(screen.getByTestId('fold-progress-readout').textContent).toBe('100%');
    expect(screen.getByTestId('studio-leaf-readout').textContent).toBe('0/4');

    // Unfold to flat A4 stack via slider
    const slider = screen.getByLabelText('Lipatan');
    fireEvent.change(slider, { target: { value: '0' } });
    expect(screen.getByTestId('fold-progress-readout').textContent).toBe('0%');
    expect(screen.getByTestId('studio-3d-status').textContent).toContain('Lembar A4 Datar (2 Lembar)');

    // Toggle exploded stack
    const explodeBtn = screen.getByRole('button', { name: /Pisah Lembar/i });
    expect(explodeBtn.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(explodeBtn);
    expect(explodeBtn.getAttribute('aria-pressed')).toBe('true');

    // Open booklet & flip next leaf (auto-folds back to 100%)
    fireEvent.click(screen.getByRole('button', { name: /^Buka$/i }));
    expect(screen.getByTestId('fold-progress-readout').textContent).toBe('100%');
    expect(screen.getByTestId('studio-leaf-readout').textContent).toBe('1/4');

    fireEvent.click(screen.getByLabelText('Halaman 3D berikutnya'));
    expect(screen.getByTestId('studio-leaf-readout').textContent).toBe('2/4');

    // Collapse & expand bottom control dock
    const dockToggle = screen.getByTestId('toggle-3d-dock');
    expect(dockToggle.textContent).toContain('Sembunyikan Kontrol');
    fireEvent.click(dockToggle);
    expect(dockToggle.textContent).toContain('Tampilkan Kontrol 3D');
  });
});
