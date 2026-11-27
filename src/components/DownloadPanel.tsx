import React, { useState } from 'react';
import { Download, Printer, Check, ChevronDown } from 'lucide-react';
import { ImpositionResult } from '../types/booklet';
import { generateBookletPdf } from '../utils/pdfGenerator';
import { useToast } from '../context/ToastContext';
import { parsePdfError } from '../utils/errorParser';

interface DownloadPanelProps {
  sourcePdfBytes: ArrayBuffer | null;
  imposition: ImpositionResult;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pdfjsDoc?: any;
}

export const DownloadPanel: React.FC<DownloadPanelProps> = ({
  sourcePdfBytes,
  imposition,
  pdfjsDoc,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressStatus, setProgressStatus] = useState('');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const { showSuccess, showError } = useToast();

  const handleDownload = async (mode: 'all' | 'odd-only' | 'even-only' = 'all') => {
    if (!sourcePdfBytes) return;

    try {
      setIsGenerating(true);
      setDownloadSuccess(false);
      setProgressPercent(5);
      setProgressStatus('Menyiapkan generator PDF...');

      const generatedBytes = await generateBookletPdf(
        sourcePdfBytes,
        imposition,
        {
          mode,
          pdfjsDoc,
          onProgress: (status, percentage) => {
            setProgressStatus(status);
            if (typeof percentage === 'number') {
              setProgressPercent(percentage);
            }
          },
        }
      );

      setProgressPercent(100);

      // Create download blob
      const blob = new Blob([generatedBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      let suffix = '';
      if (mode === 'odd-only') suffix = '_Sisi-Depan-Ganjil';
      if (mode === 'even-only') suffix = '_Sisi-Belakang-Genap';

      const baseName = imposition.metadata.filename.replace(/\.pdf$/i, '');
      const downloadName = `Booklet_${baseName}_A4-Lanskap${suffix}.pdf`;

      const link = document.createElement('a');
      link.href = url;
      link.download = downloadName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 5000);

      setDownloadSuccess(true);
      showSuccess(
        'Booklet Siap Dicetak!',
        `Berkas "${downloadName}" berhasil dibuat dan diunduh ke perangkat Anda.`
      );

      setTimeout(() => {
        setDownloadSuccess(false);
      }, 6000);
    } catch (err) {
      console.error('Error generating PDF:', err);
      const parsed = parsePdfError(err, imposition.metadata.filename);
      showError(parsed.title, parsed.message);
    } finally {
      setIsGenerating(false);
      setProgressStatus('');
      setProgressPercent(0);
    }
  };

  const compressionLevel = imposition.options.compressionLevel || 'standard';
  const compressionLabel =
    compressionLevel === 'balanced'
      ? 'Kompresi Seimbang (~200 DPI)'
      : compressionLevel === 'compact'
      ? 'Kompresi Ringan (~150 DPI)'
      : compressionLevel === 'standard'
      ? 'Lossless Standar'
      : 'Tanpa Kompresi';

  return (
    <div className="bg-neutral-950 dark:bg-[#161616] text-neutral-50 border border-neutral-950 dark:border-neutral-700 p-5 transition-colors">
      <div className="mb-4">
        <div className="text-xs font-mono text-neutral-400">
          Ekspor PDF Siap Cetak
        </div>
        <h3 className="font-display text-lg font-bold text-white mt-0.5">
          Unduh Booklet A4 Lanskap
        </h3>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-300 mt-1.5 font-mono tabular-nums">
          <span>{imposition.metadata.totalSheets} lembar A4</span>
          <span className="text-neutral-600" aria-hidden="true">·</span>
          <span>{imposition.metadata.paddedPageCount} halaman</span>
          <span className="text-neutral-600" aria-hidden="true">·</span>
          <span className="text-neutral-400 font-sans">{compressionLabel}</span>
        </div>
      </div>

      {/* Real-time Percentage Progress Bar */}
      {isGenerating && (
        <div className="mb-4 p-3 bg-neutral-900 dark:bg-[#0D0D0D] border border-neutral-700">
          <div className="flex items-center justify-between text-xs font-medium text-neutral-200 mb-2">
            <span className="truncate pr-2">{progressStatus || 'Memproses berkas...'}</span>
            <span className="font-mono text-white tabular-nums shrink-0">{progressPercent}%</span>
          </div>
          <div className="w-full h-1.5 bg-neutral-800 overflow-hidden">
            <div
              className="h-full bg-[#D9381E] transition-all duration-200"
              style={{ width: `${Math.max(5, progressPercent)}%` }}
            />
          </div>
        </div>
      )}

      {/* Primary Download CTA */}
      <button
        type="button"
        onClick={() => handleDownload('all')}
        disabled={isGenerating || !sourcePdfBytes}
        className="w-full py-3.5 px-4 bg-[#D9381E] hover:bg-[#B82B14] active:bg-[#99220F] text-white font-bold transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
      >
        {isGenerating ? (
          <>
            <span className="w-4 h-4 border-2 border-white border-t-transparent animate-spin inline-block" />
            <span className="truncate font-mono tabular-nums">
              Membuat Booklet ({progressPercent}%)...
            </span>
          </>
        ) : downloadSuccess ? (
          <>
            <Check className="w-4 h-4" />
            <span>Berhasil Diunduh — Siap Dicetak</span>
          </>
        ) : (
          <>
            <Download className="w-4 h-4" />
            <span>Unduh PDF Booklet Lengkap</span>
          </>
        )}
      </button>

      {/* Quick Duplex instruction reminder */}
      <div className="mt-4 pt-3.5 border-t border-neutral-800 text-xs text-neutral-300 flex items-start gap-2.5 leading-relaxed">
        <Printer className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
        <div>
          <strong className="text-white">Pengaturan cetak:</strong> Orientasi Lanskap, cetak dua sisi (Duplex), pilih <strong className="text-amber-300">Flip on short edge</strong> (balik pada tepi pendek).
        </div>
      </div>

      {/* Advanced / Manual Duplex Options */}
      <div className="mt-4 pt-3.5 border-t border-neutral-800">
        <button
          type="button"
          onClick={() => setShowAdvancedOptions((prev) => !prev)}
          className="text-xs text-neutral-300 hover:text-white flex items-center justify-between w-full transition-colors cursor-pointer"
        >
          <span>Opsi Printer Manual Duplex (Cetak Terpisah)</span>
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform ${
              showAdvancedOptions ? 'rotate-180' : ''
            }`}
          />
        </button>

        {showAdvancedOptions && (
          <div className="mt-3 space-y-2.5 pt-1 text-xs">
            <p className="text-[11px] text-neutral-400 leading-normal">
              Untuk printer tanpa fitur bolak-balik otomatis, unduh sisi depan dan belakang secara terpisah:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleDownload('odd-only')}
                disabled={isGenerating}
                className="py-2.5 px-3 bg-neutral-900 hover:bg-neutral-800 text-white border border-neutral-700 text-left transition-colors flex items-center justify-between cursor-pointer"
              >
                <div>
                  <div className="font-semibold text-xs">1. Sisi Depan</div>
                  <div className="text-[10px] text-neutral-400 font-mono">Halaman ganjil</div>
                </div>
                <Download className="w-3.5 h-3.5 text-neutral-400" />
              </button>

              <button
                type="button"
                onClick={() => handleDownload('even-only')}
                disabled={isGenerating}
                className="py-2.5 px-3 bg-neutral-900 hover:bg-neutral-800 text-white border border-neutral-700 text-left transition-colors flex items-center justify-between cursor-pointer"
              >
                <div>
                  <div className="font-semibold text-xs">2. Sisi Belakang</div>
                  <div className="text-[10px] text-neutral-400 font-mono">Halaman genap</div>
                </div>
                <Download className="w-3.5 h-3.5 text-neutral-400" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
