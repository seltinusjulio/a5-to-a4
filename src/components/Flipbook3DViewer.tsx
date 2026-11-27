import React, { useState, useEffect, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
  ChevronLeft,
  ChevronRight,
  BookOpen,
  BookMarked,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';
import { ImpositionResult, PageCropBox } from '../types/booklet';
import { renderPageThumbnail } from '../utils/pdfRenderer';
import { detectPageCropBox } from '../utils/autoCrop';

interface Flipbook3DViewerProps {
  imposition: ImpositionResult;
  pdfDocument: pdfjsLib.PDFDocumentProxy | null;
}

interface BookLeaf {
  leafIndex: number; // 0-based
  frontPage: number | null; // Right side when unflipped (odd: 1, 3, 5...)
  backPage: number | null; // Left side after flipped (even: 2, 4, 6...)
  frontIsCover: boolean;
  backIsBackCover: boolean;
}

/**
 * Mode 3D Ringan (CSS 3D):
 * Animasi buka-tutup sampul dan balik halaman booklet secara perspektif 3D
 * tanpa beban WebGL/GPU berat.
 */
export const Flipbook3DViewer: React.FC<Flipbook3DViewerProps> = ({
  imposition,
  pdfDocument,
}) => {
  const paddedCount = imposition.metadata.paddedPageCount;
  const originalCount = imposition.metadata.originalPageCount;
  const totalLeaves = Math.max(1, paddedCount / 2);

  // Number of leaves currently flipped to the left stack:
  // 0 = closed on front cover
  // 1..totalLeaves-1 = open spread showing pages (2*flippedCount) & (2*flippedCount + 1)
  // totalLeaves = closed on back cover
  const [flippedCount, setFlippedCount] = useState<number>(0);
  const [tiltAngle, setTiltAngle] = useState<number>(14); // subtle 3D isometric viewing pitch (0..28 deg)
  const [thumbnails, setThumbnails] = useState<Record<number, string>>({});
  const [cropBoxes, setCropBoxes] = useState<Record<number, PageCropBox>>({});

  // Build ordered booklet leaves using the exact imposition virtual sequence
  const leaves: BookLeaf[] = React.useMemo(() => {
    // Map virtualIndex (1..paddedCount) -> actual pageNumber | null
    const virtualMap = new Map<number, { pageNumber: number | null; isCover: boolean; isBackCover: boolean }>();
    imposition.sheets.forEach((sheet) => {
      const pages = [
        sheet.front.leftPage,
        sheet.front.rightPage,
        sheet.back.leftPage,
        sheet.back.rightPage,
      ];
      pages.forEach((p) => {
        virtualMap.set(p.virtualIndex, {
          pageNumber: p.pageNumber,
          isCover: p.isCover,
          isBackCover: p.isBackCover,
        });
      });
    });

    const list: BookLeaf[] = [];
    for (let i = 0; i < totalLeaves; i++) {
      const frontVirtual = i * 2 + 1;
      const backVirtual = i * 2 + 2;
      const frontInfo = virtualMap.get(frontVirtual);
      const backInfo = virtualMap.get(backVirtual);

      list.push({
        leafIndex: i,
        frontPage: frontInfo?.pageNumber ?? (frontVirtual <= originalCount ? frontVirtual : null),
        backPage: backInfo?.pageNumber ?? (backVirtual <= originalCount ? backVirtual : null),
        frontIsCover: Boolean(frontInfo?.isCover || frontVirtual === 1),
        backIsBackCover: Boolean(backInfo?.isBackCover || backVirtual === paddedCount),
      });
    }
    return list;
  }, [imposition.sheets, totalLeaves, originalCount, paddedCount]);

  // Reset when document changes
  useEffect(() => {
    setFlippedCount(0);
    setThumbnails({});
    setCropBoxes({});
  }, [
    imposition.metadata.filename,
    paddedCount,
    imposition.options.autoCropWhiteMargins,
    imposition.options.cropPaddingMm,
    imposition.options.cropThreshold,
  ]);

  // Prefetch visible and neighboring leaves thumbnails
  useEffect(() => {
    if (!pdfDocument) return;

    const pagesToLoad = new Set<number>();
    const startLeaf = Math.max(0, flippedCount - 2);
    const endLeaf = Math.min(totalLeaves - 1, flippedCount + 2);

    for (let i = startLeaf; i <= endLeaf; i++) {
      const leaf = leaves[i];
      if (!leaf) continue;
      if (leaf.frontPage) pagesToLoad.add(leaf.frontPage);
      if (leaf.backPage) pagesToLoad.add(leaf.backPage);
    }

    let cancelled = false;

    pagesToLoad.forEach(async (pNum) => {
      if (thumbnails[pNum]) return;
      let cropBox: PageCropBox | undefined = cropBoxes[pNum];

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
        } catch {
          // Ignore individual page crop detection failures
        }
      }

      const url = await renderPageThumbnail(pdfDocument, pNum, 520, cropBox);
      if (!cancelled && url) {
        setThumbnails((prev) => ({ ...prev, [pNum]: url }));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    pdfDocument,
    flippedCount,
    totalLeaves,
    leaves,
    thumbnails,
    cropBoxes,
    imposition.metadata.filename,
    imposition.options.autoCropWhiteMargins,
    imposition.options.cropPaddingMm,
    imposition.options.cropThreshold,
  ]);

  const handleNext = useCallback(() => {
    setFlippedCount((prev) => Math.min(totalLeaves, prev + 1));
  }, [totalLeaves]);

  const handlePrev = useCallback(() => {
    setFlippedCount((prev) => Math.max(0, prev - 1));
  }, []);

  const handleCloseFront = () => setFlippedCount(0);
  const handleCloseBack = () => setFlippedCount(totalLeaves);
  const handleOpenCover = () => setFlippedCount(1);

  // Keyboard arrow navigation when focused inside flipbook
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      handleNext();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      handlePrev();
    }
  };

  // Determine spread status text
  const statusLabel =
    flippedCount === 0
      ? 'Sampul Depan (Tertutup)'
      : flippedCount === totalLeaves
      ? 'Sampul Belakang (Tertutup)'
      : `Terbuka · Hal ${leaves[flippedCount - 1]?.backPage ?? 'Kosong'} & Hal ${leaves[flippedCount]?.frontPage ?? 'Kosong'}`;

  // Center the book visually when closed on front cover or back cover
  const bookTranslateX =
    flippedCount === 0 ? '-25%' : flippedCount === totalLeaves ? '25%' : '0%';

  const outerMarginMm = imposition.options.outerMarginMm ?? 3;
  const gutterMarginMm = imposition.options.gutterMarginMm ?? 2;
  const padOuterPct = Math.min(12, (outerMarginMm / 148) * 100);
  const padGutterPct = Math.min(12, (gutterMarginMm / 148) * 100);

  const renderPageFace = (
    pageNum: number | null,
    side: 'front' | 'back',
    isCover: boolean,
    isBackCover: boolean
  ) => {
    const thumb = pageNum ? thumbnails[pageNum] : null;
    const isLeftOnSpread = side === 'back';

    return (
      <div
        className="relative w-full h-full bg-white dark:bg-[#1E1E1E] overflow-hidden flex items-center justify-center border border-neutral-300 dark:border-neutral-700"
        style={{
          paddingTop: `${padOuterPct}%`,
          paddingBottom: `${padOuterPct}%`,
          paddingLeft: isLeftOnSpread ? `${padOuterPct}%` : `${padGutterPct}%`,
          paddingRight: isLeftOnSpread ? `${padGutterPct}%` : `${padOuterPct}%`,
        }}
      >
        {pageNum === null ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-[#FAFAF8] dark:bg-[#151515] border border-dashed border-neutral-300 dark:border-neutral-700">
            <span className="font-mono text-sm text-neutral-400">∅</span>
            <span className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400 mt-0.5">
              Halaman Kosong
            </span>
          </div>
        ) : thumb ? (
          <img
            src={thumb}
            alt={`Halaman ${pageNum}`}
            draggable={false}
            className="max-w-full max-h-full object-contain select-none"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-[#FAFAF8] dark:bg-[#171717]">
            <span className="font-mono text-2xl font-bold text-neutral-800 dark:text-neutral-200 tabular-nums">
              {pageNum}
            </span>
            <span className="text-[10px] font-mono text-neutral-500 mt-1">
              {isCover ? 'SAMPUL DEPAN' : isBackCover ? 'SAMPUL BELAKANG' : `HALAMAN ${pageNum}`}
            </span>
          </div>
        )}

        {/* Spine shading gradient to simulate paper curvature into saddle-stitch fold */}
        <div
          aria-hidden="true"
          className="absolute inset-y-0 w-7 pointer-events-none"
          style={
            isLeftOnSpread
              ? {
                  right: 0,
                  background:
                    'linear-gradient(to left, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0.06) 45%, rgba(0,0,0,0) 100%)',
                }
              : {
                  left: 0,
                  background:
                    'linear-gradient(to right, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0.06) 45%, rgba(0,0,0,0) 100%)',
                }
          }
        />

        {/* Corner badge */}
        <div
          className={`absolute bottom-1.5 ${
            isLeftOnSpread ? 'left-2' : 'right-2'
          } px-1.5 py-0.5 bg-neutral-950/80 text-white text-[9px] font-mono tabular-nums pointer-events-none`}
        >
          {pageNum ? `P${pageNum}` : 'BLANK'}
        </div>

        {isCover && (
          <div className="absolute top-1.5 right-2 px-1.5 py-0.5 bg-[#D9381E] text-white text-[9px] font-mono font-bold pointer-events-none">
            SAMPUL
          </div>
        )}
        {isBackCover && (
          <div className="absolute top-1.5 left-2 px-1.5 py-0.5 bg-neutral-900 text-white text-[9px] font-mono font-bold pointer-events-none">
            BELAKANG
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="bg-[#ECECE8] dark:bg-[#0D0D0D] prepress-grid outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      data-testid="flipbook-3d-viewer"
    >
      {/* Top Status & Quick Action Bar */}
      <div className="px-4 sm:px-5 py-2.5 bg-white dark:bg-[#161616] border-b border-neutral-300 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 bg-neutral-950 dark:bg-neutral-100 text-white dark:text-neutral-950">
            CSS 3D
          </span>
          <span className="font-bold text-neutral-950 dark:text-white" data-testid="flipbook-status">
            {statusLabel}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 border border-neutral-300 dark:border-neutral-700 px-2 py-1 bg-[#FAFAF8] dark:bg-[#121212]">
            <SlidersHorizontal className="w-3 h-3 text-neutral-500" />
            <label htmlFor="flipbook-tilt" className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400">
              Sudut
            </label>
            <input
              id="flipbook-tilt"
              type="range"
              min={0}
              max={28}
              step={2}
              value={tiltAngle}
              onChange={(e) => setTiltAngle(Number(e.target.value))}
              className="w-16 accent-[#D9381E] cursor-pointer"
            />
            <span className="font-mono text-[10px] tabular-nums text-neutral-700 dark:text-neutral-300 w-7 text-right">
              {tiltAngle}°
            </span>
          </div>

          <button
            type="button"
            onClick={flippedCount === 0 ? handleOpenCover : handleCloseFront}
            className="h-7 px-2.5 border border-neutral-900 dark:border-neutral-600 bg-white dark:bg-[#1E1E1E] hover:bg-neutral-950 hover:text-white dark:hover:bg-neutral-100 dark:hover:text-neutral-950 text-neutral-900 dark:text-neutral-100 text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {flippedCount === 0 ? (
              <>
                <BookOpen className="w-3.5 h-3.5" />
                <span>Buka Sampul</span>
              </>
            ) : (
              <>
                <BookMarked className="w-3.5 h-3.5" />
                <span>Tutup Depan</span>
              </>
            )}
          </button>

          {flippedCount !== totalLeaves && (
            <button
              type="button"
              onClick={handleCloseBack}
              className="h-7 px-2.5 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#1E1E1E] hover:border-neutral-900 dark:hover:border-neutral-400 text-neutral-700 dark:text-neutral-300 text-[11px] font-semibold transition-colors cursor-pointer"
            >
              Sampul Belakang
            </button>
          )}
        </div>
      </div>

      {/* 3D Perspective Stage */}
      <div className="px-4 py-10 sm:py-14 flex flex-col items-center justify-center overflow-hidden min-h-[420px] sm:min-h-[480px]">
        <div
          className="relative w-full max-w-[540px] aspect-[297/210]"
          style={{ perspective: '1600px' }}
        >
          {/* Animated Book Assembly */}
          <div
            className="relative w-full h-full transition-transform duration-700 ease-out"
            style={{
              transformStyle: 'preserve-3d',
              transform: `rotateX(${tiltAngle}deg) translateX(${bookTranslateX})`,
            }}
          >
            {/* Contact drop shadow beneath book */}
            <div
              aria-hidden="true"
              className="absolute inset-y-2 pointer-events-none transition-all duration-700"
              style={{
                left: flippedCount === 0 ? '50%' : '1%',
                right: flippedCount === totalLeaves ? '50%' : '1%',
                transform: 'translateZ(-14px) translateY(10px)',
                background: 'rgba(13, 13, 13, 0.24)',
                filter: 'blur(14px)',
              }}
            />

            {/* Spine Metallic Staples Indicator */}
            <div
              aria-hidden="true"
              className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[3px] bg-neutral-800 dark:bg-neutral-400 pointer-events-none flex flex-col items-center justify-around py-10"
              style={{ transform: 'translateX(-50%) translateZ(2px)', zIndex: totalLeaves + 20 }}
            >
              <div className="w-[4px] h-5 bg-neutral-300 border border-neutral-700" />
              <div className="w-[4px] h-5 bg-neutral-300 border border-neutral-700" />
            </div>

            {/* Individual 3D Leaves */}
            {leaves.map((leaf, index) => {
              const isFlipped = index < flippedCount;
              // Stack ordering: unflipped pages descend from top (index=0 highest),
              // flipped pages ascend so latest flipped page stays on top of left stack
              const zIndex = isFlipped ? index + 1 : totalLeaves - index + 1;
              // Slight Z-offset so stacked leaves show real physical paper depth without Z-fighting
              const stackZ = isFlipped
                ? (index - totalLeaves) * 0.45
                : (totalLeaves - index) * 0.45;

              return (
                <div
                  key={leaf.leafIndex}
                  data-testid={`flipbook-leaf-${leaf.leafIndex}`}
                  data-flipped={isFlipped ? 'true' : 'false'}
                  onClick={() => {
                    if (isFlipped) {
                      setFlippedCount(index);
                    } else {
                      setFlippedCount(index + 1);
                    }
                  }}
                  title={
                    isFlipped
                      ? 'Klik untuk membalik kembali ke kanan'
                      : 'Klik untuk membalik halaman ke kiri'
                  }
                  className="absolute top-0 right-0 w-1/2 h-full cursor-pointer"
                  style={{
                    transformOrigin: 'left center',
                    transformStyle: 'preserve-3d',
                    zIndex,
                    transform: `translateZ(${stackZ}px) rotateY(${isFlipped ? -180 : 0}deg)`,
                    transition: 'transform 680ms cubic-bezier(0.22, 1, 0.36, 1)',
                  }}
                >
                  {/* Front Side of Leaf (Visible on Right before flipping) */}
                  <div
                    className="absolute inset-0"
                    style={{
                      backfaceVisibility: 'hidden',
                      WebkitBackfaceVisibility: 'hidden',
                    }}
                  >
                    {renderPageFace(leaf.frontPage, 'front', leaf.frontIsCover, false)}
                  </div>

                  {/* Back Side of Leaf (Visible on Left after flipping 180 deg) */}
                  <div
                    className="absolute inset-0"
                    style={{
                      backfaceVisibility: 'hidden',
                      WebkitBackfaceVisibility: 'hidden',
                      transform: 'rotateY(180deg)',
                    }}
                  >
                    {renderPageFace(leaf.backPage, 'back', false, leaf.backIsBackCover)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <p className="mt-6 text-[11px] font-mono text-neutral-500 dark:text-neutral-400 text-center">
          Klik langsung halaman kiri/kanan atau gunakan tombol panah keyboard (← / →) untuk membalik.
        </p>
      </div>

      {/* Bottom Navigation Bar */}
      <div className="px-4 sm:px-5 py-3 border-t border-neutral-300 dark:border-neutral-800 bg-[#FAFAF8] dark:bg-[#121212] flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={handlePrev}
          disabled={flippedCount === 0}
          className="h-8 px-3 text-xs font-semibold border border-neutral-900 dark:border-neutral-600 bg-white dark:bg-[#161616] hover:bg-neutral-950 hover:text-white dark:hover:bg-neutral-100 dark:hover:text-neutral-950 text-neutral-900 dark:text-neutral-100 disabled:opacity-35 disabled:pointer-events-none flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Halaman Sebelumnya</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-semibold tabular-nums text-neutral-800 dark:text-neutral-200">
            Lembar {flippedCount} / {totalLeaves}
          </span>
          {flippedCount > 0 && (
            <button
              type="button"
              onClick={handleCloseFront}
              title="Ulang ke sampul depan"
              className="h-7 w-7 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#1E1E1E] hover:border-neutral-900 dark:hover:border-neutral-400 flex items-center justify-center text-neutral-700 dark:text-neutral-300 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={handleNext}
          disabled={flippedCount >= totalLeaves}
          className="h-8 px-3 text-xs font-semibold border border-neutral-900 dark:border-neutral-600 bg-white dark:bg-[#161616] hover:bg-neutral-950 hover:text-white dark:hover:bg-neutral-100 dark:hover:text-neutral-950 text-neutral-900 dark:text-neutral-100 disabled:opacity-35 disabled:pointer-events-none flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <span>Balik Halaman</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
