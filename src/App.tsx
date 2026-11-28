/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef } from 'react';
import { Printer, ArrowRight } from 'lucide-react';
import { Navbar } from './components/Navbar';
import { UploadZone } from './components/UploadZone';
import { BatchQueue } from './components/BatchQueue';
import { DocumentSummary } from './components/DocumentSummary';
import { BookletSettings } from './components/BookletSettings';
import { SheetViewer } from './components/SheetViewer';
import { ErrorBoundary } from './components/ErrorBoundary';
import { DownloadPanel } from './components/DownloadPanel';
import { PrintGuideModal } from './components/PrintGuideModal';
import { FoldingGuideSection } from './components/FoldingGuideSection';
import { FaqSection } from './components/FaqSection';
import { BatchItem, BookletOptions } from './types/booklet';
import { calculateImposition } from './utils/imposition';
import {
  loadPdfDocument,
  loadPdfFromArrayBuffer,
  clearThumbnailCache,
} from './utils/pdfRenderer';
import { saveBinaryFile } from './utils/fileSave';
import { createSampleA5Pdf } from './utils/samplePdf';
import { exportBatchAsZip, ZipExportProgress } from './utils/zipExport';
import { generateBookletPdf } from './utils/pdfGenerator';
import { clearCropCache } from './utils/autoCrop';
import { useToast } from './context/ToastContext';
import { parsePdfError } from './utils/errorParser';

const DEFAULT_OPTIONS: BookletOptions = {
  blankPlacement: 'end',
  outerMarginMm: 3,
  gutterMarginMm: 2,
  marginMm: 3,
  showFoldLine: true,
  scaleMode: 'fit',
  alignment: 'center',
  sourceDimensionPreset: 'auto',
  customSourceWidthMm: 148,
  customSourceHeightMm: 210,
  compressionLevel: 'balanced',
  autoCropWhiteMargins: false,
  cropPaddingMm: 3,
  cropThreshold: 245,
};

export default function App() {
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [activeItemId, setActiveItemId] = useState<string>('');
  const [globalOptions, setGlobalOptions] = useState<BookletOptions>(DEFAULT_OPTIONS);

  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPrintGuideOpen, setIsPrintGuideOpen] = useState(false);

  // Batch ZIP export progress
  const [isZipping, setIsZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState<ZipExportProgress | null>(null);

  const foldingGuideRef = useRef<HTMLDivElement>(null);
  const faqRef = useRef<HTMLDivElement>(null);

  // Active batch item
  const activeItem = batchItems.find((it) => it.id === activeItemId) || batchItems[0] || null;

  const { showSuccess, showError, showWarning } = useToast();

  // Process uploaded files into batch queue
  const handleFilesSelected = async (files: File[]) => {
    if (!files || files.length === 0) return;

    setIsLoading(true);
    setErrorMessage(null);

    const newItems: BatchItem[] = files.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      file,
      filename: file.name,
      fileSizeBytes: file.size,
      status: 'processing',
      errorMessage: null,
      progress: 0,
      loadedDoc: null,
      imposition: null,
      options: { ...globalOptions },
    }));

    // Append to batch queue
    setBatchItems((prev) => [...prev, ...newItems]);
    if (!activeItemId && newItems.length > 0) {
      setActiveItemId(newItems[0].id);
    }

    let successCount = 0;
    let failCount = 0;

    // Process files sequentially
    for (let i = 0; i < newItems.length; i++) {
      const item = newItems[i];
      setLoadingMessage(`Membaca berkas ${i + 1} dari ${newItems.length}: ${item.filename}...`);

      try {
        const loadedDoc = await loadPdfDocument(item.file!);
        const imposition = calculateImposition(
          loadedDoc.metadata.originalPageCount,
          globalOptions,
          loadedDoc.metadata
        );

        setBatchItems((prev) =>
          prev.map((it) =>
            it.id === item.id
              ? {
                  ...it,
                  status: 'ready',
                  loadedDoc,
                  imposition,
                }
              : it
          )
        );

        successCount++;

        // If no active item yet, activate this one
        setActiveItemId((currentActive) => (currentActive ? currentActive : item.id));
      } catch (err) {
        console.error(`Error loading ${item.filename}:`, err);
        failCount++;
        const parsed = parsePdfError(err, item.filename);

        setBatchItems((prev) =>
          prev.map((it) =>
            it.id === item.id
              ? {
                  ...it,
                  status: 'error',
                  errorMessage: parsed.message,
                }
              : it
          )
        );

        showError(parsed.title, parsed.message);
      }
    }

    setIsLoading(false);
    setLoadingMessage('');

    if (successCount > 0 && failCount === 0) {
      showSuccess(
        'Berkas Berhasil Dimuat',
        `${successCount} berkas PDF siap untuk diatur susunan booklet dan dicetak.`
      );
    } else if (successCount > 0 && failCount > 0) {
      showWarning(
        'Sebagian Berkas Berhasil Dimuat',
        `${successCount} berkas siap diproses, namun ${failCount} berkas mengalami kendala.`
      );
    }
  };

  // Add 8-page sample document to batch
  const handleUseSample = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      setLoadingMessage('Menyiapkan contoh dokumen A5 (8 Halaman)...');

      const sampleBuffer = await createSampleA5Pdf();
      const filename = `Contoh-Booklet-A5-${batchItems.length + 1}.pdf`;
      const loadedDoc = await loadPdfFromArrayBuffer(sampleBuffer, filename);
      const imposition = calculateImposition(
        loadedDoc.metadata.originalPageCount,
        globalOptions,
        loadedDoc.metadata
      );

      const newItem: BatchItem = {
        id: `sample-${Date.now()}`,
        file: null,
        filename,
        fileSizeBytes: sampleBuffer.byteLength,
        status: 'ready',
        errorMessage: null,
        progress: 100,
        loadedDoc,
        imposition,
        options: { ...globalOptions },
      };

      setBatchItems((prev) => [newItem, ...prev]);
      setActiveItemId(newItem.id);
    } catch (err) {
      console.error('Error generating sample:', err);
      setErrorMessage('Gagal memuat contoh dokumen A5.');
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  // Update options and recalculate imposition for active item and batch
  const handleOptionsChange = (updatedOptions: BookletOptions) => {
    if (
      updatedOptions.autoCropWhiteMargins !== globalOptions.autoCropWhiteMargins ||
      updatedOptions.cropPaddingMm !== globalOptions.cropPaddingMm ||
      updatedOptions.cropThreshold !== globalOptions.cropThreshold
    ) {
      clearCropCache();
      clearThumbnailCache();
    }

    setGlobalOptions(updatedOptions);

    setBatchItems((prev) =>
      prev.map((item) => {
        if (!item.loadedDoc) return item;
        const newImp = calculateImposition(
          item.loadedDoc.metadata.originalPageCount,
          updatedOptions,
          item.loadedDoc.metadata
        );
        return {
          ...item,
          options: updatedOptions,
          imposition: newImp,
          generatedPdfBytes: null, // invalidate cached PDF bytes
        };
      })
    );
  };

  const handleRemoveItem = (id: string) => {
    setBatchItems((prev) => {
      const filtered = prev.filter((it) => it.id !== id);
      if (activeItemId === id && filtered.length > 0) {
        setActiveItemId(filtered[0].id);
      } else if (filtered.length === 0) {
        setActiveItemId('');
      }
      return filtered;
    });
  };

  const handleClearAll = () => {
    clearThumbnailCache();
    setBatchItems([]);
    setActiveItemId('');
  };

  // Download individual batch item
  const handleDownloadItem = async (item: BatchItem) => {
    if (!item.loadedDoc || !item.imposition) return;

    try {
      const generatedBytes = await generateBookletPdf(
        item.loadedDoc.arrayBuffer,
        item.imposition,
        {
          mode: 'all',
          pdfjsDoc: item.loadedDoc.pdfDocument,
        }
      );

      const cleanBaseName = item.filename.replace(/\.pdf$/i, '');
      const downloadName = `Booklet_${cleanBaseName}_A4-Lanskap.pdf`;

      const { saved } = await saveBinaryFile({
        data: generatedBytes,
        defaultFilename: downloadName,
        mimeType: 'application/pdf',
        filterName: 'Dokumen PDF',
        filterExtensions: ['pdf'],
      });

      if (!saved) {
        return;
      }

      showSuccess(
        'Booklet Siap Dicetak!',
        `Berkas "${downloadName}" berhasil dibuat dan disimpan ke perangkat Anda.`
      );
    } catch (err) {
      console.error('Error downloading item:', err);
      const parsed = parsePdfError(err, item.filename);
      showError(parsed.title, parsed.message);
    }
  };

  // Download all batch items as single ZIP archive
  const handleDownloadAllZip = async () => {
    const readyItems = batchItems.filter((it) => it.loadedDoc && it.imposition);
    if (readyItems.length === 0) {
      showWarning(
        'Belum Ada Berkas Siap',
        'Tidak ada berkas PDF yang valid dan siap diunduh dalam antrean.'
      );
      return;
    }

    try {
      setIsZipping(true);
      setZipProgress({
        currentFile: 'Memulai pengemasan ZIP...',
        currentIndex: 0,
        totalFiles: readyItems.length,
        percentage: 0,
      });

      const saved = await exportBatchAsZip(readyItems, (progress) => {
        setZipProgress(progress);
      });

      if (saved) {
        showSuccess(
          'Arsip ZIP Berhasil Dibuat!',
          `Semua ${readyItems.length} berkas booklet dan panduan cetak telah dikompresi ke dalam ZIP.`
        );
      }
    } catch (err) {
      console.error('Error exporting ZIP:', err);
      showError(
        'Gagal Mengemas Arsip ZIP',
        (err as Error).message || 'Terjadi kesalahan saat membuat berkas arsip ZIP.'
      );
    } finally {
      setIsZipping(false);
      setZipProgress(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F3] dark:bg-[#0D0D0D] flex flex-col text-neutral-950 dark:text-neutral-100 transition-colors">
      {/* Top Bar Navigation */}
      <Navbar
        onOpenGuide={() => setIsPrintGuideOpen(true)}
        onOpenWorkings={() => foldingGuideRef.current?.scrollIntoView({ behavior: 'smooth' })}
        onOpenFaq={() => faqRef.current?.scrollIntoView({ behavior: 'smooth' })}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-10">
        {/* Editorial Prepress Masthead (Left-aligned, boxy architectural grid — no centered AI pill hero) */}
        <section className="border-b border-neutral-900 dark:border-neutral-800 pb-7">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
            <div className="lg:col-span-8">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-mono text-neutral-600 dark:text-neutral-400 mb-3">
                <span className="text-[#D9381E] dark:text-[#F04A2E] font-semibold">Imposisi 2-Up</span>
                <span aria-hidden="true">/</span>
                <span>A5 ke A4 Lanskap</span>
                <span aria-hidden="true">/</span>
                <span>Lokal & Offline di Peramban</span>
              </div>

              <h1 className="font-display text-3xl sm:text-5xl font-extrabold text-neutral-950 dark:text-white tracking-tight leading-[1.08] text-balance">
                Konverter Booklet PDF Siap Cetak A4
              </h1>
            </div>

            <div className="lg:col-span-4 lg:border-l lg:border-neutral-300 dark:lg:border-neutral-800 lg:pl-6">
              <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
                Susun halaman naskah potret secara otomatis menjadi tata letak 2-Up untuk jilid lipat tengah. Mendukung batch multi-file, auto-crop margin putih, dan kompresi PDF.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-mono text-neutral-500 dark:text-neutral-400">
                <span>Tanpa unggah server</span>
                <span aria-hidden="true">·</span>
                <span>Ekspor PDF & ZIP</span>
              </div>
            </div>
          </div>
        </section>

        {/* Workspace: Either Empty Dropzone OR Batch Queue + Active Editor */}
        {batchItems.length === 0 ? (
          <UploadZone
            onFilesSelected={handleFilesSelected}
            onUseSample={handleUseSample}
            isLoading={isLoading}
            loadingMessage={loadingMessage}
            errorMessage={errorMessage}
          />
        ) : (
          <div className="space-y-6">
            {/* Batch Files Queue strip */}
            <BatchQueue
              items={batchItems}
              activeItemId={activeItemId}
              onSelectActiveItem={setActiveItemId}
              onRemoveItem={handleRemoveItem}
              onClearAll={handleClearAll}
              onAddMoreFiles={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.pdf,application/pdf';
                input.multiple = true;
                input.onchange = (e: any) => {
                  if (e.target.files) {
                    handleFilesSelected(Array.from(e.target.files));
                  }
                };
                input.click();
              }}
              onDownloadItem={handleDownloadItem}
              onDownloadAllZip={handleDownloadAllZip}
              isZipping={isZipping}
              zipProgress={zipProgress}
            />

            {/* Active Document Details */}
            {activeItem && activeItem.loadedDoc && activeItem.imposition && (
              <>
                <DocumentSummary
                  metadata={activeItem.imposition.metadata}
                  onReset={() => handleRemoveItem(activeItem.id)}
                />

                {/* Two-Column Grid: Preview on Left, Settings & Download on Right */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Left Column (8 cols): Interactive Sheet & Booklet Reader Previewer */}
                  <div className="lg:col-span-8 space-y-6">
                    <ErrorBoundary
                      resetKey={activeItem.id}
                      title="Pratinjau lembar mengalami kendala"
                      description="Panel pratinjau terhenti sementara, namun Anda tetap dapat mengunduh hasil booklet atau memuat ulang pratinjau."
                    >
                      <SheetViewer
                        imposition={activeItem.imposition}
                        pdfDocument={activeItem.loadedDoc.pdfDocument}
                      />
                    </ErrorBoundary>
                  </div>

                  {/* Right Column (4 cols): Download & Settings */}
                  <div className="lg:col-span-4 space-y-6">
                    {/* Primary Download Panel */}
                    <DownloadPanel
                      sourcePdfBytes={activeItem.loadedDoc.arrayBuffer}
                      imposition={activeItem.imposition}
                      pdfjsDoc={activeItem.loadedDoc.pdfDocument}
                    />

                    {/* Advanced Customization Options */}
                    <BookletSettings
                      options={globalOptions}
                      onChangeOptions={handleOptionsChange}
                      blankPagesAdded={activeItem.imposition.metadata.blankPagesAdded}
                      detectedDimensions={{
                        widthMm: activeItem.imposition.metadata.detectedWidthMm,
                        heightMm: activeItem.imposition.metadata.detectedHeightMm,
                        description: activeItem.imposition.metadata.dimensionsDescription,
                      }}
                    />

                    {/* Printing Instructions Callout (Boxy flat border) */}
                    <div className="bg-[#FAFAF8] dark:bg-[#161616] border border-neutral-900 dark:border-neutral-700 p-4 text-xs">
                      <div className="flex items-center gap-2 font-display font-bold text-neutral-950 dark:text-white mb-1.5">
                        <Printer className="w-4 h-4 text-[#D9381E] dark:text-[#F04A2E]" />
                        <span>Kunci Cetak Bolak-Balik (Duplex)</span>
                      </div>
                      <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed mb-3.5">
                        Pilih orientasi <strong className="text-neutral-950 dark:text-white">Lanskap</strong> di printer dan aktifkan cetak dua sisi dengan opsi <strong className="text-neutral-950 dark:text-white">Flip on short edge</strong> (balik pada tepi pendek).
                      </p>
                      <button
                        type="button"
                        onClick={() => setIsPrintGuideOpen(true)}
                        className="w-full py-2.5 px-3 bg-white dark:bg-[#1E1E1E] hover:bg-neutral-950 hover:text-white dark:hover:bg-neutral-100 dark:hover:text-neutral-950 text-neutral-950 dark:text-neutral-100 border border-neutral-900 dark:border-neutral-600 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <span>Buka Panduan Cetak Lengkap</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Section: Folding & Assembly Simulation */}
        <div ref={foldingGuideRef}>
          <FoldingGuideSection />
        </div>

        {/* Section: FAQ */}
        <div ref={faqRef}>
          <FaqSection />
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-16 bg-white dark:bg-[#121212] border-t border-neutral-900 dark:border-neutral-800 py-6 text-xs text-neutral-600 dark:text-neutral-400 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-display font-bold text-neutral-950 dark:text-white">BukuCepat</span>
            <span aria-hidden="true">·</span>
            <span>Konverter Booklet PDF A5 ke A4 Lanskap</span>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-neutral-500 dark:text-neutral-400">
            <span>Pemrosesan 100% lokal di peramban</span>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => setIsPrintGuideOpen(true)}
              className="hover:text-neutral-950 dark:hover:text-white underline underline-offset-2 cursor-pointer"
            >
              Panduan Cetak
            </button>
          </div>
        </div>
      </footer>

      {/* Print Instructions Modal */}
      <PrintGuideModal
        isOpen={isPrintGuideOpen}
        onClose={() => setIsPrintGuideOpen(false)}
      />
    </div>
  );
}
