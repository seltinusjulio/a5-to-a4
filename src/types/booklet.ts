export type BlankPlacementStrategy = 'end' | 'before-back-cover';

export type PrintMode = 'duplex-auto' | 'duplex-manual-odd' | 'duplex-manual-even';

export type SourceDimensionPreset =
  | 'auto' // Deteksi otomatis dari berkas PDF
  | 'a5' // A5: 148 x 210 mm
  | 'half-letter' // Half Letter / Statement: 139.7 x 215.9 mm (5.5 x 8.5 in)
  | 'a4' // A4: 210 x 297 mm
  | 'letter' // US Letter: 215.9 x 279.4 mm
  | 'custom'; // Kustom ukuran mm

export type PdfCompressionLevel =
  | 'none' // Ukuran asli tanpa optimasi
  | 'standard' // Standar (Flate stream compression tanpa render ulang gambar)
  | 'balanced' // Seimbang (Rekomendasi: Optimasi gambar ~200 DPI, hemat 50-70% berkas)
  | 'compact'; // Sangat Ringan (Resolusi ~150 DPI, sangat hemat ukuran)

export interface BookletOptions {
  blankPlacement: BlankPlacementStrategy;
  outerMarginMm: number; // Margin luar lembar A4 (atas, bawah, sisi luar)
  gutterMarginMm: number; // Margin punggung lipatan tengah (spine gutter)
  marginMm: number; // Alias untuk outerMarginMm
  showFoldLine: boolean;
  scaleMode: 'fit' | 'actual';
  alignment: 'center' | 'spine' | 'outer';
  sourceDimensionPreset: SourceDimensionPreset;
  customSourceWidthMm: number;
  customSourceHeightMm: number;
  compressionLevel: PdfCompressionLevel;
  autoCropWhiteMargins: boolean;
  cropPaddingMm: number; // Bantalan isi setelah dipotong (default 3 mm)
  cropThreshold: number; // Ambang batas warna putih (0-255, default 245)
}

export interface PageCropBox {
  x: number; // Titik X bawah-kiri dalam point PDF
  y: number; // Titik Y bawah-kiri dalam point PDF
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  hasCropped: boolean;
}

export interface ImpositionPageInfo {
  pageNumber: number | null; // 1-based original page number or null if blank
  virtualIndex: number; // 1-based index in the padded M-sequence
  label: string;
  isCover: boolean;
  isBackCover: boolean;
  isBlank: boolean;
}

export interface SheetSideInfo {
  sheetNumber: number;
  side: 'front' | 'back';
  sideName: 'Sisi Depan (Muka)' | 'Sisi Belakang';
  outputPdfPageIndex: number; // 1-based page in output PDF
  leftPage: ImpositionPageInfo;
  rightPage: ImpositionPageInfo;
}

export interface SheetInfo {
  sheetNumber: number;
  front: SheetSideInfo;
  back: SheetSideInfo;
}

export interface DocumentMetadata {
  filename: string;
  fileSizeBytes: number;
  originalPageCount: number;
  paddedPageCount: number;
  blankPagesAdded: number;
  totalSheets: number;
  pageWidthPt: number;
  pageHeightPt: number;
  isA5Estimated: boolean;
  dimensionsDescription: string;
  detectedWidthMm: number;
  detectedHeightMm: number;
}

export interface ImpositionResult {
  metadata: DocumentMetadata;
  sheets: SheetInfo[];
  options: BookletOptions;
}

export interface BatchItem {
  id: string;
  file: File | null; // null for sample
  filename: string;
  fileSizeBytes: number;
  status: 'pending' | 'processing' | 'ready' | 'generating' | 'completed' | 'error';
  errorMessage: string | null;
  progress: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  loadedDoc: any | null;
  imposition: ImpositionResult | null;
  options: BookletOptions;
  generatedPdfBytes?: Uint8Array | null;
}
