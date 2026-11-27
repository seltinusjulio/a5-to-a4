import React, { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
  RotateCw,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Layers,
  Columns2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Ruler,
  Crosshair,
  Box,
} from 'lucide-react';
import {
  ImpositionPageInfo,
  ImpositionResult,
  PageCropBox,
  SheetInfo,
  SheetSideInfo,
} from '../types/booklet';
import { renderPageThumbnail } from '../utils/pdfRenderer';
import { detectPageCropBox } from '../utils/autoCrop';
import { Flipbook3DViewer } from './Flipbook3DViewer';
import { Interactive3DBookletViewer } from './Interactive3DBookletViewer';
import { ErrorBoundary } from './ErrorBoundary';

interface SheetViewerProps {
  imposition: ImpositionResult;
  pdfDocument: pdfjsLib.PDFDocumentProxy | null;
}

const MIN_ZOOM = 50;
const MAX_ZOOM = 250;
const ZOOM_STEP = 25;

export const SheetViewer: React.FC<SheetViewerProps> = ({
  imposition,
  pdfDocument,
}) => {
  const [viewMode, setViewMode] = useState<'sheet' | 'side-by-side' | 'reader' | '3d'>('sheet');
  const [preview3DMode, setPreview3DMode] = useState<'flipbook' | 'studio'>('flipbook');
  const [activeSheetIndex, setActiveSheetIndex] = useState(0); // 0-based
  const [activeSide, setActiveSide] = useState<'front' | 'back'>('front');
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [showMarginGuides, setShowMarginGuides] = useState<boolean>(true);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [cropBoxes, setCropBoxes] = useState<Record<number, PageCropBox>>({});
  const thumbnailsRef = useRef(thumbnails);
  const cropBoxesRef = useRef(cropBoxes);
  thumbnailsRef.current = thumbnails;
  cropBoxesRef.current = cropBoxes;
  const [isFlipping, setIsFlipping] = useState(false);

  // Drag-to-pan state for zoomed inspection
  const singleScrollRef = useRef<HTMLDivElement>(null);
  const frontScrollRef = useRef<HTMLDivElement>(null);
  const backScrollRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const panOriginRef = useRef<{
    target: HTMLDivElement | null;
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
  }>({ target: null, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 });

  const cropCacheKey = `${imposition.options.autoCropWhiteMargins}_${imposition.options.cropPaddingMm}_${imposition.options.cropThreshold}`;

  // Clear thumbnails when crop settings change
  useEffect(() => {
    if (!cropCacheKey) return;
    setThumbnails({});
    setCropBoxes({});
  }, [cropCacheKey]);

  // Clamp activeSheetIndex when sheets count decreases (e.g., switching documents)
  useEffect(() => {
    if (activeSheetIndex >= imposition.sheets.length) {
      setActiveSheetIndex(0);
    }
  }, [imposition.sheets.length, activeSheetIndex]);

  // Virtual reader spread state (0 = cover, 1 = pages 2-3, 2 = pages 4-5, etc.)
  const [readerSpreadIndex, setReaderSpreadIndex] = useState(0);

  const sheets = imposition.sheets;
  const currentSheet: SheetInfo | undefined = sheets[activeSheetIndex];
  const currentSideInfo: SheetSideInfo | undefined =
    currentSheet ? (activeSide === 'front' ? currentSheet.front : currentSheet.back) : undefined;

  const totalReaderSpreads = Math.ceil(imposition.metadata.paddedPageCount / 2);

  // Render crisp higher-resolution thumbnails when zoomed in
  const targetThumbWidth = zoomLevel > 125 ? 880 : 440;

  // Pre-render thumbnails for active sheets
  useEffect(() => {
    if (!pdfDocument || !currentSheet) return;

    const pagesToRender = new Set<number>();
    const addIfValid = (num: number | null | undefined) => {
      if (num !== null && num !== undefined && num > 0) {
        pagesToRender.add(num);
      }
    };

    addIfValid(currentSheet.front.leftPage.pageNumber);
    addIfValid(currentSheet.front.rightPage.pageNumber);
    addIfValid(currentSheet.back.leftPage.pageNumber);
    addIfValid(currentSheet.back.rightPage.pageNumber);

    // Prefetch for reader mode
    const readerLeft = readerSpreadIndex * 2;
    const readerRight = readerSpreadIndex * 2 + 1;
    if (readerLeft > 0 && readerLeft <= imposition.metadata.originalPageCount) {
      pagesToRender.add(readerLeft);
    }
    if (readerRight > 0 && readerRight <= imposition.metadata.originalPageCount) {
      pagesToRender.add(readerRight);
    }

    let cancelled = false;

    pagesToRender.forEach(async (pNum) => {
      const thumbKey = `${pNum}_${targetThumbWidth}`;
      if (thumbnailsRef.current[thumbKey]) return;

      let cropBox: PageCropBox | undefined = cropBoxesRef.current[pNum];
      if (imposition.options.autoCropWhiteMargins && !cropBox) {
        try {
          const pageProxy = await pdfDocument.getPage(pNum);
          cropBox = await detectPageCropBox(
            pageProxy,
            imposition.metadata.filename,
            pNum,
            imposition.options.cropPaddingMm ?? 3,
            imposition.options.cropThreshold ?? 245
          );
          if (!cancelled && cropBox) {
            setCropBoxes((prev) => ({ ...prev, [pNum]: cropBox! }));
          }
        } catch (e) {
          console.warn(`Could not detect crop box for page ${pNum}:`, e);
        }
      }

      const url = await renderPageThumbnail(pdfDocument, pNum, targetThumbWidth, cropBox);
      if (!cancelled && url) {
        setThumbnails((prev) => ({ ...prev, [thumbKey]: url }));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    pdfDocument,
    currentSheet,
    readerSpreadIndex,
    targetThumbWidth,
    imposition.metadata.originalPageCount,
    imposition.metadata.filename,
    imposition.options.autoCropWhiteMargins,
    imposition.options.cropPaddingMm,
    imposition.options.cropThreshold,
  ]);

  const getThumbUrl = (pageNumber: number | null): string | null => {
    if (!pageNumber) return null;
    // Prefer current target resolution, fall back to standard 440px while high-res renders
    return thumbnails[`${pageNumber}_${targetThumbWidth}`] || thumbnails[`${pageNumber}_440`] || null;
  };

  const handleFlip = () => {
    setIsFlipping(true);
    setTimeout(() => {
      setActiveSide((prev) => (prev === 'front' ? 'back' : 'front'));
      setIsFlipping(false);
    }, 150);
  };

  const handlePrevSheet = () => {
    if (activeSheetIndex > 0) {
      setActiveSheetIndex((prev) => prev - 1);
    }
  };

  const handleNextSheet = () => {
    if (activeSheetIndex < sheets.length - 1) {
      setActiveSheetIndex((prev) => prev + 1);
    }
  };

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(MAX_ZOOM, prev + ZOOM_STEP));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(MIN_ZOOM, prev - ZOOM_STEP));
  };

  const handleZoomReset = () => {
    setZoomLevel(100);
  };

  // Center scroll horizontally on the fold spine line
  const handleCenterOnFold = () => {
    const containers =
      viewMode === 'side-by-side'
        ? [frontScrollRef.current, backScrollRef.current]
        : [singleScrollRef.current];

    containers.forEach((el) => {
      if (!el) return;
      const targetLeft = Math.max(0, (el.scrollWidth - el.clientWidth) / 2);
      const targetTop = Math.max(0, (el.scrollHeight - el.clientHeight) / 2);
      el.scrollTo({ left: targetLeft, top: targetTop, behavior: 'smooth' });
    });
  };

  // Drag-to-pan handlers
  const handlePanStart = (e: React.MouseEvent<HTMLDivElement>) => {
    if (zoomLevel <= 100) return;
    const el = e.currentTarget;
    setIsPanning(true);
    panOriginRef.current = {
      target: el,
      startX: e.clientX,
      startY: e.clientY,
      scrollLeft: el.scrollLeft,
      scrollTop: el.scrollTop,
    };
  };

  const handlePanMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPanning || !panOriginRef.current.target) return;
    e.preventDefault();
    const el = panOriginRef.current.target;
    const dx = e.clientX - panOriginRef.current.startX;
    const dy = e.clientY - panOriginRef.current.startY;
    el.scrollLeft = panOriginRef.current.scrollLeft - dx;
    el.scrollTop = panOriginRef.current.scrollTop - dy;
  };

  const handlePanEnd = () => {
    setIsPanning(false);
    panOriginRef.current.target = null;
  };

  if (!currentSheet || !currentSideInfo) {
    return null;
  }

  const outerMarginMm = imposition.options.outerMarginMm ?? 3;
  const gutterMarginMm = imposition.options.gutterMarginMm ?? 2;
  const alignment = imposition.options.alignment || 'center';

  // Exact percentage geometry on A4 Landscape (297 x 210 mm)
  const outerPctX = (outerMarginMm / 297) * 100;
  const outerPctY = (outerMarginMm / 210) * 100;
  const gutterPctHalf = (gutterMarginMm / 297) * 100; // per side of fold line

  /**
   * Renders a true-proportion 297x210 mm A4 Landscape sheet with live margin,
   * spine gutter, alignment, and center fold-line overlays.
   */
  const renderProportionalA4Sheet = (
    sideInfo: SheetSideInfo,
    options: { baseWidthPx: number; compactHeader?: boolean }
  ) => {
    const scaledWidthPx = Math.round((options.baseWidthPx * zoomLevel) / 100);
    const leftThumb = getThumbUrl(sideInfo.leftPage.pageNumber);
    const rightThumb = getThumbUrl(sideInfo.rightPage.pageNumber);

    const getHorizontalJustify = (isRight: boolean) => {
      if (alignment === 'spine') {
        return isRight ? 'justify-start' : 'justify-end';
      }
      if (alignment === 'outer') {
        return isRight ? 'justify-end' : 'justify-start';
      }
      return 'justify-center';
    };

    const renderPageContent = (pageInfo: ImpositionPageInfo, thumbUrl: string | null, isRight: boolean) => {
      const isCropped =
        pageInfo.pageNumber &&
        imposition.options.autoCropWhiteMargins &&
        cropBoxes[pageInfo.pageNumber]?.hasCropped;

      return (
        <div
          className={`relative h-full w-full flex items-center ${getHorizontalJustify(isRight)} overflow-hidden bg-white dark:bg-[#191919] ${
            showMarginGuides ? 'border border-dashed border-neutral-300 dark:border-neutral-700' : ''
          }`}
        >
          {pageInfo.isBlank ? (
            <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center bg-[#FAFAF8] dark:bg-[#121212]">
              <span className="font-mono text-xs text-neutral-400">∅</span>
              <span className="text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 mt-0.5">
                Kosong
              </span>
            </div>
          ) : thumbUrl ? (
            <img
              src={thumbUrl}
              alt={pageInfo.label}
              draggable={false}
              className="max-w-full max-h-full object-contain select-none"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center">
              <div className="w-5 h-5 border-2 border-neutral-900 dark:border-white border-t-transparent animate-spin mb-1.5" />
              <span className="text-[10px] font-mono text-neutral-500 dark:text-neutral-400">
                Hal {pageInfo.pageNumber}
              </span>
            </div>
          )}

          {/* Subtle corner page stamp */}
          <div className="absolute bottom-0 right-0 px-1.5 py-0.5 bg-neutral-950/85 text-white text-[9px] font-mono tabular-nums pointer-events-none flex items-center gap-1">
            <span>{pageInfo.pageNumber ? `P${pageInfo.pageNumber}` : 'BLANK'}</span>
            {isCropped && <span className="text-emerald-400">CROP</span>}
          </div>

          {pageInfo.isCover && (
            <div className="absolute top-0 left-0 px-1.5 py-0.5 bg-[#D9381E] text-white text-[9px] font-mono font-semibold pointer-events-none">
              SAMPUL
            </div>
          )}
          {pageInfo.isBackCover && (
            <div className="absolute top-0 left-0 px-1.5 py-0.5 bg-neutral-900 text-white text-[9px] font-mono font-semibold pointer-events-none">
              BELAKANG
            </div>
          )}
        </div>
      );
    };

    return (
      <div
        style={{ width: `${scaledWidthPx}px` }}
        className="mx-auto shrink-0 select-none"
      >
        {/* True A4 Landscape Paper Surface (297 x 210 mm) */}
        <div
          className="relative w-full aspect-[297/210] bg-white dark:bg-[#1E1E1E] border-2 border-neutral-900 dark:border-neutral-500 overflow-hidden"
          data-testid={`a4-sheet-${sideInfo.side}`}
        >
          {/* Visual Outer Margin Zone Highlight */}
          {showMarginGuides && outerMarginMm > 0 && (
            <div
              aria-hidden="true"
              className="absolute inset-0 pointer-events-none z-10"
              style={{
                borderTopWidth: `${(outerMarginMm / 210) * (scaledWidthPx * (210 / 297))}px`,
                borderBottomWidth: `${(outerMarginMm / 210) * (scaledWidthPx * (210 / 297))}px`,
                borderLeftWidth: `${(outerMarginMm / 297) * scaledWidthPx}px`,
                borderRightWidth: `${(outerMarginMm / 297) * scaledWidthPx}px`,
                borderStyle: 'solid',
                borderColor: 'rgba(115, 115, 115, 0.14)',
              }}
            />
          )}

          {/* Left Slot (positioned with exact outer margin + gutter) */}
          <div
            className="absolute"
            style={{
              top: `${outerPctY}%`,
              bottom: `${outerPctY}%`,
              left: `${outerPctX}%`,
              width: `${Math.max(1, 50 - outerPctX - gutterPctHalf)}%`,
            }}
          >
            {renderPageContent(sideInfo.leftPage, leftThumb, false)}
          </div>

          {/* Right Slot (positioned with exact gutter + outer margin) */}
          <div
            className="absolute"
            style={{
              top: `${outerPctY}%`,
              bottom: `${outerPctY}%`,
              left: `${50 + gutterPctHalf}%`,
              width: `${Math.max(1, 50 - outerPctX - gutterPctHalf)}%`,
            }}
          >
            {renderPageContent(sideInfo.rightPage, rightThumb, true)}
          </div>

          {/* Visual Spine Gutter Zone Shading (both sides of center fold) */}
          {showMarginGuides && gutterMarginMm > 0 && (
            <div
              aria-hidden="true"
              className="absolute top-0 bottom-0 pointer-events-none z-20 bg-[#D9381E]/10 dark:bg-[#F04A2E]/15 border-x border-[#D9381E]/40 dark:border-[#F04A2E]/40"
              style={{
                left: `${50 - gutterPctHalf}%`,
                width: `${gutterPctHalf * 2}%`,
              }}
            />
          )}

          {/* Center Fold Spine Line + Top/Bottom Crop Tick Marks */}
          <div
            aria-hidden="true"
            className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 pointer-events-none z-30 flex flex-col items-center justify-between"
          >
            {/* Top fold registration tick */}
            <div className="w-[2px] h-3 bg-neutral-950 dark:bg-white" />

            {/* Dashed center fold line */}
            <div
              className={`flex-1 w-0 border-l-2 border-dashed ${
                imposition.options.showFoldLine
                  ? 'border-[#D9381E] dark:border-[#F04A2E]'
                  : 'border-neutral-400/60 dark:border-neutral-500/60'
              } relative flex items-center justify-center`}
            >
              {showMarginGuides && (
                <div className="px-1.5 py-0.5 bg-[#D9381E] dark:bg-[#F04A2E] text-white text-[9px] font-mono font-bold whitespace-nowrap tracking-wide">
                  LIPAT · {gutterMarginMm}mm
                </div>
              )}
            </div>

            {/* Bottom fold registration tick */}
            <div className="w-[2px] h-3 bg-neutral-950 dark:bg-white" />
          </div>
        </div>

        {/* Sheet Bottom Meta Row */}
        <div className="mt-2 flex items-center justify-between text-[11px] font-mono tabular-nums text-neutral-600 dark:text-neutral-400">
          <span>
            Kiri: <strong className="text-neutral-950 dark:text-white">{sideInfo.leftPage.pageNumber ? `Hal ${sideInfo.leftPage.pageNumber}` : 'Kosong'}</strong>
          </span>
          <span className="text-neutral-400 dark:text-neutral-600">
            PDF #{sideInfo.outputPdfPageIndex}
          </span>
          <span>
            Kanan: <strong className="text-neutral-950 dark:text-white">{sideInfo.rightPage.pageNumber ? `Hal ${sideInfo.rightPage.pageNumber}` : 'Kosong'}</strong>
          </span>
        </div>
      </div>
    );
  };

  const findSheetForPage = (targetNum: number) => {
    for (const sheet of sheets) {
      if (
        sheet.front.leftPage.pageNumber === targetNum ||
        sheet.front.rightPage.pageNumber === targetNum
      ) {
        const isLeft = sheet.front.leftPage.pageNumber === targetNum;
        return `Lembar ${sheet.sheetNumber} (Muka - ${isLeft ? 'Kiri' : 'Kanan'})`;
      }
      if (
        sheet.back.leftPage.pageNumber === targetNum ||
        sheet.back.rightPage.pageNumber === targetNum
      ) {
        const isLeft = sheet.back.leftPage.pageNumber === targetNum;
        return `Lembar ${sheet.sheetNumber} (Balik - ${isLeft ? 'Kiri' : 'Kanan'})`;
      }
    }
    return 'Halaman Kosong';
  };

  return (
    <div className="bg-white dark:bg-[#161616] border border-neutral-900 dark:border-neutral-700 transition-colors">
      {/* Viewer Header */}
      <div className="p-4 sm:px-5 border-b border-neutral-900 dark:border-neutral-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FAFAF8] dark:bg-[#121212]">
        <div>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
            <h3 className="font-display text-base font-bold text-neutral-950 dark:text-white">
              Pratinjau Imposisi Booklet
            </h3>
            <span className="text-neutral-400 dark:text-neutral-600" aria-hidden="true">·</span>
            <span className="text-xs font-mono font-semibold text-[#D9381E] dark:text-[#F04A2E] tabular-nums">
              {viewMode === 'reader'
                ? `Spread ${readerSpreadIndex + 1} / ${totalReaderSpreads}`
                : viewMode === '3d'
                ? preview3DMode === 'flipbook'
                  ? 'Flipbook 3D'
                  : 'Studio 3D Interaktif'
                : `Lembar ${currentSheet.sheetNumber} / ${sheets.length}`}
            </span>
          </div>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5">
            {viewMode === 'sheet'
              ? 'Tata letak fisik 2-up satu sisi pada kertas A4 lanskap (297 × 210 mm).'
              : viewMode === 'side-by-side'
              ? 'Bandingkan Sisi Depan dan Sisi Belakang secara berdampingan untuk memeriksa presisi garis lipatan.'
              : viewMode === '3d'
              ? preview3DMode === 'flipbook'
                ? 'Animasi 3D ringan untuk membuka, menutup sampul, dan membalik halaman hasil cetak.'
                : 'Simulasi 3D WebGL 360° lengkap dengan pelipatan lembar A4 → A5, staples punggung, dan balik halaman melengkung.'
              : 'Simulasi urutan baca halaman setelah kertas dilipat dan distaples.'}
          </p>
        </div>

        {/* View Mode Segmented Switcher (4 Boxy Tabs) */}
        <div className="flex flex-wrap border border-neutral-900 dark:border-neutral-600 self-start sm:self-auto text-xs font-semibold shrink-0">
          <button
            type="button"
            onClick={() => setViewMode('sheet')}
            className={`px-3 py-1.5 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              viewMode === 'sheet'
                ? 'bg-neutral-950 dark:bg-neutral-100 text-white dark:text-neutral-950'
                : 'bg-white dark:bg-[#1E1E1E] text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Lembar A4</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('side-by-side')}
            className={`px-3 py-1.5 border-l border-neutral-900 dark:border-neutral-600 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              viewMode === 'side-by-side'
                ? 'bg-neutral-950 dark:bg-neutral-100 text-white dark:text-neutral-950'
                : 'bg-white dark:bg-[#1E1E1E] text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            <Columns2 className="w-3.5 h-3.5" />
            <span>Berdampingan</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('reader')}
            className={`px-3 py-1.5 border-l border-neutral-900 dark:border-neutral-600 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              viewMode === 'reader'
                ? 'bg-neutral-950 dark:bg-neutral-100 text-white dark:text-neutral-950'
                : 'bg-white dark:bg-[#1E1E1E] text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Mode Baca</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('3d')}
            className={`px-3 py-1.5 border-l border-neutral-900 dark:border-neutral-600 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              viewMode === '3d'
                ? 'bg-[#D9381E] dark:bg-[#F04A2E] text-white'
                : 'bg-white dark:bg-[#1E1E1E] text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            <span>Pratinjau 3D</span>
          </button>
        </div>
      </div>

      {/* UNIFIED PROOFING TOOLBAR FOR SHEET & SIDE-BY-SIDE MODES */}
      {(viewMode === 'sheet' || viewMode === 'side-by-side') && (
        <>
          <div className="px-4 sm:px-5 py-2.5 bg-white dark:bg-[#161616] border-b border-neutral-300 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Left controls: Side switcher (in sheet mode) or Side-by-Side info + Margin Guide Toggle */}
            <div className="flex flex-wrap items-center gap-2">
              {viewMode === 'sheet' ? (
                <>
                  <div className="flex border border-neutral-300 dark:border-neutral-700 text-xs font-medium">
                    <button
                      type="button"
                      onClick={() => setActiveSide('front')}
                      className={`px-2.5 py-1.5 transition-colors whitespace-nowrap cursor-pointer ${
                        activeSide === 'front'
                          ? 'bg-neutral-950 dark:bg-neutral-100 text-white dark:text-neutral-950 font-semibold'
                          : 'bg-white dark:bg-[#1B1B1B] text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                      }`}
                    >
                      Sisi Depan
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveSide('back')}
                      className={`px-2.5 py-1.5 border-l border-neutral-300 dark:border-neutral-700 transition-colors whitespace-nowrap cursor-pointer ${
                        activeSide === 'back'
                          ? 'bg-neutral-950 dark:bg-neutral-100 text-white dark:text-neutral-950 font-semibold'
                          : 'bg-white dark:bg-[#1B1B1B] text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                      }`}
                    >
                      Sisi Belakang
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleFlip}
                    title="Balik kertas lembaran (Simulasi duplex flip)"
                    className="h-8 px-2.5 bg-white dark:bg-[#1E1E1E] hover:bg-neutral-950 hover:text-white dark:hover:bg-neutral-100 dark:hover:text-neutral-950 text-neutral-900 dark:text-neutral-100 border border-neutral-900 dark:border-neutral-600 font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>Balik</span>
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-2 text-[11px] font-mono tabular-nums text-neutral-600 dark:text-neutral-400">
                  <span className="font-semibold text-neutral-950 dark:text-white">
                    Lembar {String(currentSheet.sheetNumber).padStart(2, '0')}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>Margin {outerMarginMm}mm</span>
                  <span aria-hidden="true">·</span>
                  <span>Gutter {gutterMarginMm}mm</span>
                </div>
              )}

              {/* Toggle Margin & Fold Guides */}
              <button
                type="button"
                onClick={() => setShowMarginGuides((prev) => !prev)}
                aria-pressed={showMarginGuides}
                className={`h-8 px-2.5 border text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
                  showMarginGuides
                    ? 'border-[#D9381E] dark:border-[#F04A2E] bg-[#D9381E]/10 dark:bg-[#F04A2E]/15 text-[#D9381E] dark:text-[#F04A2E]'
                    : 'border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#1E1E1E] text-neutral-600 dark:text-neutral-400 hover:border-neutral-900 dark:hover:border-neutral-400'
                }`}
              >
                <Ruler className="w-3.5 h-3.5" />
                <span>Panduan Lipat</span>
              </button>
            </div>

            {/* Right controls: Boxy Zoom Bar & Center-on-Fold */}
            <div className="flex flex-wrap items-center gap-2">
              {zoomLevel > 100 && (
                <button
                  type="button"
                  onClick={handleCenterOnFold}
                  title="Pusatkan tampilan tepat pada garis lipatan tengah"
                  className="h-8 px-2.5 border border-neutral-900 dark:border-neutral-600 bg-white dark:bg-[#1E1E1E] hover:bg-neutral-950 hover:text-white dark:hover:bg-neutral-100 dark:hover:text-neutral-950 text-neutral-900 dark:text-neutral-100 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Crosshair className="w-3.5 h-3.5" />
                  <span>Fokus Lipatan</span>
                </button>
              )}

              <div className="flex items-center border border-neutral-900 dark:border-neutral-600 bg-white dark:bg-[#1E1E1E]">
                <button
                  type="button"
                  onClick={handleZoomOut}
                  disabled={zoomLevel <= MIN_ZOOM}
                  aria-label="Perkecil pratinjau"
                  title="Perkecil (-25%)"
                  className="h-8 w-8 flex items-center justify-center text-neutral-900 dark:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={handleZoomReset}
                  title="Kembalikan zoom ke 100%"
                  data-testid="zoom-level-readout"
                  className="h-8 px-2.5 border-x border-neutral-300 dark:border-neutral-700 font-mono text-xs font-bold tabular-nums text-neutral-950 dark:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 min-w-[54px] text-center transition-colors cursor-pointer"
                >
                  {zoomLevel}%
                </button>

                <button
                  type="button"
                  onClick={handleZoomIn}
                  disabled={zoomLevel >= MAX_ZOOM}
                  aria-label="Perbesar pratinjau"
                  title="Perbesar (+25%)"
                  className="h-8 w-8 flex items-center justify-center text-neutral-900 dark:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>

                {zoomLevel !== 100 && (
                  <button
                    type="button"
                    onClick={handleZoomReset}
                    aria-label="Reset zoom ke 100%"
                    title="Reset 100%"
                    className="h-8 w-8 border-l border-neutral-300 dark:border-neutral-700 flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* MODE 1: SINGLE SHEET VIEW */}
          {viewMode === 'sheet' && (
            <div className="p-4 sm:p-6 bg-[#ECECE8] dark:bg-[#0D0D0D] prepress-grid">
              <div className="bg-white dark:bg-[#161616] border border-neutral-900 dark:border-neutral-700">
                {/* Paper header bar */}
                <div className="px-4 py-2.5 border-b border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-2 text-xs bg-[#FAFAF8] dark:bg-[#121212]">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-neutral-950 dark:text-white font-mono tabular-nums">
                      LEMBAR {String(currentSheet.sheetNumber).padStart(2, '0')}
                    </span>
                    <span aria-hidden="true" className="text-neutral-400">·</span>
                    <span className="text-[#D9381E] dark:text-[#F04A2E] font-semibold">
                      {currentSideInfo.sideName}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] tabular-nums text-neutral-500 dark:text-neutral-400">
                    Margin {outerMarginMm}mm · Gutter {gutterMarginMm}mm · 297 × 210 mm
                  </span>
                </div>

                {/* Zoomable & Pannable Viewport */}
                <div
                  ref={singleScrollRef}
                  onMouseDown={handlePanStart}
                  onMouseMove={handlePanMove}
                  onMouseUp={handlePanEnd}
                  onMouseLeave={handlePanEnd}
                  className={`p-4 sm:p-6 overflow-auto max-h-[600px] bg-[#F5F5F3] dark:bg-[#101010] transition-opacity duration-150 ${
                    isFlipping ? 'opacity-40' : 'opacity-100'
                  } ${zoomLevel > 100 ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
                >
                  {renderProportionalA4Sheet(currentSideInfo, { baseWidthPx: 660 })}
                </div>
              </div>
            </div>
          )}

          {/* MODE 2: SIDE-BY-SIDE A4 SHEETS VIEW (Front & Back Separate with Zoom) */}
          {viewMode === 'side-by-side' && (
            <div
              className="p-4 sm:p-5 bg-[#ECECE8] dark:bg-[#0D0D0D] prepress-grid"
              data-testid="side-by-side-viewer"
            >
              {/* Quick Zoom Hint Bar */}
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-neutral-600 dark:text-neutral-400">
                <span>
                  Pratinjau terpisah <strong className="text-neutral-950 dark:text-white">Sisi Depan</strong> &{' '}
                  <strong className="text-neutral-950 dark:text-white">Sisi Belakang</strong> — geser area kertas saat zoom di atas 100% untuk memeriksa garis lipat.
                </span>
                <div className="flex items-center gap-1 font-mono tabular-nums">
                  {[100, 150, 200].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setZoomLevel(preset)}
                      className={`px-2 py-0.5 border transition-colors cursor-pointer ${
                        zoomLevel === preset
                          ? 'border-neutral-950 dark:border-neutral-100 bg-neutral-950 dark:bg-neutral-100 text-white dark:text-neutral-950 font-semibold'
                          : 'border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#161616] text-neutral-700 dark:text-neutral-300 hover:border-neutral-900 dark:hover:border-neutral-400'
                      }`}
                    >
                      {preset}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Dual A4 Panels Side-by-Side */}
              <div className="grid grid-cols-1 md:grid-cols-2 border border-neutral-900 dark:border-neutral-700 divide-y md:divide-y-0 md:divide-x divide-neutral-900 dark:divide-neutral-700 bg-white dark:bg-[#161616]">
                {/* Left Column: Sisi Depan (Muka) */}
                <div className="flex flex-col min-w-0">
                  <div className="px-4 py-2.5 border-b border-neutral-300 dark:border-neutral-800 flex items-center justify-between gap-2 bg-[#FAFAF8] dark:bg-[#121212] text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 bg-neutral-950 dark:bg-neutral-100 text-white dark:text-neutral-950 shrink-0">
                        MUKA
                      </span>
                      <span className="font-bold text-neutral-950 dark:text-white truncate">
                        Sisi Depan (Ganjil)
                      </span>
                    </div>
                    <span className="font-mono text-[11px] tabular-nums text-neutral-500 dark:text-neutral-400 shrink-0">
                      PDF #{currentSheet.front.outputPdfPageIndex}
                    </span>
                  </div>

                  <div
                    ref={frontScrollRef}
                    onMouseDown={handlePanStart}
                    onMouseMove={handlePanMove}
                    onMouseUp={handlePanEnd}
                    onMouseLeave={handlePanEnd}
                    className={`p-4 overflow-auto max-h-[520px] bg-[#F5F5F3] dark:bg-[#101010] ${
                      zoomLevel > 100 ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') : ''
                    }`}
                  >
                    {renderProportionalA4Sheet(currentSheet.front, { baseWidthPx: 340, compactHeader: true })}
                  </div>
                </div>

                {/* Right Column: Sisi Belakang */}
                <div className="flex flex-col min-w-0">
                  <div className="px-4 py-2.5 border-b border-neutral-300 dark:border-neutral-800 flex items-center justify-between gap-2 bg-[#FAFAF8] dark:bg-[#121212] text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 border border-neutral-900 dark:border-neutral-500 text-neutral-950 dark:text-white shrink-0">
                        BALIK
                      </span>
                      <span className="font-bold text-neutral-950 dark:text-white truncate">
                        Sisi Belakang (Genap)
                      </span>
                    </div>
                    <span className="font-mono text-[11px] tabular-nums text-neutral-500 dark:text-neutral-400 shrink-0">
                      PDF #{currentSheet.back.outputPdfPageIndex}
                    </span>
                  </div>

                  <div
                    ref={backScrollRef}
                    onMouseDown={handlePanStart}
                    onMouseMove={handlePanMove}
                    onMouseUp={handlePanEnd}
                    onMouseLeave={handlePanEnd}
                    className={`p-4 overflow-auto max-h-[520px] bg-[#F5F5F3] dark:bg-[#101010] ${
                      zoomLevel > 100 ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') : ''
                    }`}
                  >
                    {renderProportionalA4Sheet(currentSheet.back, { baseWidthPx: 340, compactHeader: true })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Sheet Navigation Bar */}
          <div className="px-4 sm:px-5 py-3 border-t border-neutral-300 dark:border-neutral-800 bg-[#FAFAF8] dark:bg-[#121212] flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handlePrevSheet}
              disabled={activeSheetIndex === 0}
              className="h-8 px-3 text-xs font-semibold border border-neutral-900 dark:border-neutral-600 bg-white dark:bg-[#161616] hover:bg-neutral-950 hover:text-white dark:hover:bg-neutral-100 dark:hover:text-neutral-950 text-neutral-900 dark:text-neutral-100 disabled:opacity-35 disabled:pointer-events-none flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Sebelumnya</span>
            </button>

            <span className="text-xs font-mono font-semibold tabular-nums text-neutral-800 dark:text-neutral-200">
              Lembar {activeSheetIndex + 1} dari {sheets.length}
            </span>

            <button
              type="button"
              onClick={handleNextSheet}
              disabled={activeSheetIndex === sheets.length - 1}
              className="h-8 px-3 text-xs font-semibold border border-neutral-900 dark:border-neutral-600 bg-white dark:bg-[#161616] hover:bg-neutral-950 hover:text-white dark:hover:bg-neutral-100 dark:hover:text-neutral-950 text-neutral-900 dark:text-neutral-100 disabled:opacity-35 disabled:pointer-events-none flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>Berikutnya</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Sheet Index Strip */}
          <div className="p-4 sm:px-5 border-t border-neutral-900 dark:border-neutral-700 bg-white dark:bg-[#161616]">
            <div className="text-xs font-bold text-neutral-900 dark:text-neutral-100 mb-2.5">
              Indeks Seluruh Lembar Fisik ({sheets.length} Lembar A4)
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {sheets.map((sheet, idx) => {
                const isSelected = idx === activeSheetIndex;
                return (
                  <button
                    key={sheet.sheetNumber}
                    type="button"
                    onClick={() => setActiveSheetIndex(idx)}
                    className={`shrink-0 p-2.5 border text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-neutral-950 dark:border-neutral-100 bg-neutral-950 dark:bg-neutral-100 text-white dark:text-neutral-950'
                        : 'border-neutral-300 dark:border-neutral-700 hover:border-neutral-900 dark:hover:border-neutral-400 bg-[#FAFAF8] dark:bg-[#1B1B1B] text-neutral-900 dark:text-neutral-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 text-xs mb-1">
                      <span className="font-bold font-mono tabular-nums">
                        L{String(sheet.sheetNumber).padStart(2, '0')}
                      </span>
                      {idx === 0 && (
                        <span
                          className={`text-[10px] font-semibold ${
                            isSelected
                              ? 'text-[#F04A2E] dark:text-[#D9381E]'
                              : 'text-[#D9381E] dark:text-[#F04A2E]'
                          }`}
                        >
                          Sampul
                        </span>
                      )}
                    </div>
                    <div
                      className={`text-[10px] font-mono tabular-nums leading-tight ${
                        isSelected
                          ? 'text-neutral-300 dark:text-neutral-600'
                          : 'text-neutral-500 dark:text-neutral-400'
                      }`}
                    >
                      M: [{sheet.front.leftPage.pageNumber ?? '∅'}|{sheet.front.rightPage.pageNumber ?? '∅'}]
                    </div>
                    <div
                      className={`text-[10px] font-mono tabular-nums leading-tight ${
                        isSelected
                          ? 'text-neutral-300 dark:text-neutral-600'
                          : 'text-neutral-500 dark:text-neutral-400'
                      }`}
                    >
                      B: [{sheet.back.leftPage.pageNumber ?? '∅'}|{sheet.back.rightPage.pageNumber ?? '∅'}]
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* MODE 3: VIRTUAL BOOKLET READER MODE */}
      {viewMode === 'reader' && (
        <div className="p-5 sm:p-8 bg-[#ECECE8] dark:bg-[#0D0D0D] prepress-grid">
          <div className="max-w-2xl mx-auto bg-white dark:bg-[#161616] p-5 sm:p-7 border-2 border-neutral-900 dark:border-neutral-600">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-neutral-200 dark:border-neutral-800">
              <div>
                <span className="text-xs font-mono text-[#D9381E] dark:text-[#F04A2E] font-semibold">
                  Simulasi Buku Saku
                </span>
                <h4 className="font-display text-base font-bold text-neutral-950 dark:text-white mt-0.5">
                  {readerSpreadIndex === 0
                    ? 'Sampul Depan (Buku Tertutup)'
                    : readerSpreadIndex === totalReaderSpreads - 1
                    ? 'Sampul Belakang'
                    : `Halaman ${readerSpreadIndex * 2} & Halaman ${readerSpreadIndex * 2 + 1}`}
                </h4>
              </div>

              <span className="text-xs font-mono tabular-nums text-neutral-500 dark:text-neutral-400">
                Spread {readerSpreadIndex + 1} / {totalReaderSpreads}
              </span>
            </div>

            {/* Virtual Book Open Graphic */}
            <div className="flex items-stretch border border-neutral-900 dark:border-neutral-600 my-6 bg-[#FAFAF8] dark:bg-[#121212]">
              {/* Left Page */}
              <div className="flex-1 p-4 sm:p-6 bg-[#FAFAF8] dark:bg-[#121212] border-r border-neutral-300 dark:border-neutral-800 flex flex-col justify-between aspect-[1/1.414]">
                {readerSpreadIndex === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-neutral-400 text-xs text-center">
                    <span>Buku Tertutup</span>
                    <span className="text-[11px] text-neutral-500 mt-1">Sampul belakang di sisi balik</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-center text-[11px] text-neutral-500 mb-2">
                      <span>Kiri</span>
                      <span className="font-mono text-neutral-900 dark:text-neutral-200 font-semibold tabular-nums">
                        Hal {readerSpreadIndex * 2}
                      </span>
                    </div>

                    <div className="flex-1 flex items-center justify-center overflow-hidden my-1">
                      {getThumbUrl(readerSpreadIndex * 2) ? (
                        <img
                          src={getThumbUrl(readerSpreadIndex * 2)!}
                          alt={`Hal ${readerSpreadIndex * 2}`}
                          className="max-h-56 object-contain"
                        />
                      ) : (
                        <div className="text-center font-mono text-2xl font-bold text-neutral-800 dark:text-neutral-200 tabular-nums">
                          {readerSpreadIndex * 2 > imposition.metadata.originalPageCount ? (
                            <span className="text-neutral-400 text-xs font-sans font-normal">Halaman Kosong</span>
                          ) : (
                            readerSpreadIndex * 2
                          )}
                        </div>
                      )}
                    </div>

                    <div className="text-[10px] text-neutral-500 dark:text-neutral-400 text-center font-mono pt-1">
                      {findSheetForPage(readerSpreadIndex * 2)}
                    </div>
                  </>
                )}
              </div>

              {/* Spine Crease */}
              <div className="w-1.5 bg-neutral-300 dark:bg-neutral-700 relative flex flex-col justify-around items-center">
                <div className="w-2.5 h-1 bg-neutral-900 dark:bg-neutral-300" />
                <div className="w-2.5 h-1 bg-neutral-900 dark:bg-neutral-300" />
              </div>

              {/* Right Page */}
              <div className="flex-1 p-4 sm:p-6 bg-white dark:bg-[#161616] flex flex-col justify-between aspect-[1/1.414]">
                {readerSpreadIndex === 0 ? (
                  <>
                    <div className="flex justify-between items-center text-[11px] text-[#D9381E] dark:text-[#F04A2E] mb-2 font-semibold">
                      <span>Sampul Depan</span>
                      <span className="font-mono">Hal 1</span>
                    </div>

                    <div className="flex-1 flex items-center justify-center overflow-hidden my-1">
                      {getThumbUrl(1) ? (
                        <img
                          src={getThumbUrl(1)!}
                          alt="Sampul Depan"
                          className="max-h-56 object-contain"
                        />
                      ) : (
                        <div className="text-center font-mono text-2xl font-bold text-neutral-950 dark:text-white">
                          Hal 1
                        </div>
                      )}
                    </div>

                    <div className="text-[10px] text-neutral-500 dark:text-neutral-400 text-center font-mono pt-1">
                      {findSheetForPage(1)}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between items-center text-[11px] text-neutral-500 mb-2">
                      <span className="font-mono text-neutral-900 dark:text-neutral-200 font-semibold tabular-nums">
                        Hal {readerSpreadIndex * 2 + 1}
                      </span>
                      <span>Kanan</span>
                    </div>

                    <div className="flex-1 flex items-center justify-center overflow-hidden my-1">
                      {getThumbUrl(readerSpreadIndex * 2 + 1) ? (
                        <img
                          src={getThumbUrl(readerSpreadIndex * 2 + 1)!}
                          alt={`Hal ${readerSpreadIndex * 2 + 1}`}
                          className="max-h-56 object-contain"
                        />
                      ) : (
                        <div className="text-center font-mono text-2xl font-bold text-neutral-950 dark:text-white tabular-nums">
                          {readerSpreadIndex * 2 + 1 > imposition.metadata.originalPageCount ? (
                            <span className="text-neutral-400 text-xs font-sans font-normal">Halaman Kosong</span>
                          ) : (
                            readerSpreadIndex * 2 + 1
                          )}
                        </div>
                      )}
                    </div>

                    <div className="text-[10px] text-neutral-500 dark:text-neutral-400 text-center font-mono pt-1">
                      {findSheetForPage(readerSpreadIndex * 2 + 1)}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Stepper Controls */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setReaderSpreadIndex((prev) => Math.max(0, prev - 1))}
                disabled={readerSpreadIndex === 0}
                className="h-9 px-3.5 text-xs font-semibold border border-neutral-900 dark:border-neutral-600 bg-white dark:bg-[#1E1E1E] text-neutral-900 dark:text-neutral-100 disabled:opacity-35 disabled:pointer-events-none hover:bg-neutral-950 hover:text-white dark:hover:bg-neutral-100 dark:hover:text-neutral-950 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Balik Kiri</span>
              </button>

              <span className="text-xs text-neutral-500 dark:text-neutral-400 hidden sm:inline">
                Navigasi urutan halaman buku
              </span>

              <button
                type="button"
                onClick={() =>
                  setReaderSpreadIndex((prev) => Math.min(totalReaderSpreads - 1, prev + 1))
                }
                disabled={readerSpreadIndex === totalReaderSpreads - 1}
                className="h-9 px-3.5 text-xs font-semibold border border-neutral-900 dark:border-neutral-600 bg-white dark:bg-[#1E1E1E] text-neutral-900 dark:text-neutral-100 disabled:opacity-35 disabled:pointer-events-none hover:bg-neutral-950 hover:text-white dark:hover:bg-neutral-100 dark:hover:text-neutral-950 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>Buka Kanan</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODE 4: 3D PRINT RESULT PREVIEW (LIGHTWEIGHT FLIPBOOK + FULL INTERACTIVE 3D STUDIO) */}
      {viewMode === '3d' && (
        <div data-testid="preview-3d-panel">
          {/* 3D Sub-Mode Switcher Toolbar */}
          <div className="px-4 sm:px-5 py-2.5 bg-white dark:bg-[#161616] border-b border-neutral-900 dark:border-neutral-700 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex border border-neutral-900 dark:border-neutral-600 font-semibold">
              <button
                type="button"
                onClick={() => setPreview3DMode('flipbook')}
                data-testid="btn-3d-flipbook"
                className={`px-3 py-1.5 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  preview3DMode === 'flipbook'
                    ? 'bg-neutral-950 dark:bg-neutral-100 text-white dark:text-neutral-950'
                    : 'bg-white dark:bg-[#1E1E1E] text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Flipbook 3D (Ringan)</span>
              </button>
              <button
                type="button"
                onClick={() => setPreview3DMode('studio')}
                data-testid="btn-3d-studio"
                className={`px-3 py-1.5 border-l border-neutral-900 dark:border-neutral-600 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  preview3DMode === 'studio'
                    ? 'bg-neutral-950 dark:bg-neutral-100 text-white dark:text-neutral-950'
                    : 'bg-white dark:bg-[#1E1E1E] text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
              >
                <Box className="w-3.5 h-3.5" />
                <span>Studio 3D Lengkap</span>
              </button>
            </div>

            <span className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
              {preview3DMode === 'flipbook'
                ? 'Buka-tutup sampul & balik halaman instan'
                : 'Orbit 360° · Lipat A4→A5 · Staples · Pisah lembar'}
            </span>
          </div>

          <ErrorBoundary
            resetKey={preview3DMode}
            title="Pratinjau 3D mengalami kendala grafis"
            description="Terjadi gangguan saat merender tampilan 3D. Anda dapat memuat ulang panel ini atau beralih ke mode Flipbook 3D (Ringan)."
          >
            {preview3DMode === 'flipbook' ? (
              <Flipbook3DViewer imposition={imposition} pdfDocument={pdfDocument} />
            ) : (
              <Interactive3DBookletViewer imposition={imposition} pdfDocument={pdfDocument} />
            )}
          </ErrorBoundary>
        </div>
      )}
    </div>
  );
};
