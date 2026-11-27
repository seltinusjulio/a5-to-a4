import React from 'react';
import { FileText, RefreshCw } from 'lucide-react';
import { DocumentMetadata } from '../types/booklet';

interface DocumentSummaryProps {
  metadata: DocumentMetadata;
  onReset: () => void;
}

export const DocumentSummary: React.FC<DocumentSummaryProps> = ({
  metadata,
  onReset,
}) => {
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  return (
    <div className="bg-white dark:bg-[#161616] border border-neutral-900 dark:border-neutral-700 transition-colors">
      {/* Header row */}
      <div className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-300 dark:border-neutral-800">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 bg-neutral-950 dark:bg-neutral-100 text-white dark:text-neutral-950 flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-baseline gap-2.5">
              <h3 className="font-display text-base font-bold text-neutral-950 dark:text-white truncate">
                {metadata.filename}
              </h3>
              <span className="text-xs font-mono text-neutral-500 dark:text-neutral-400 tabular-nums shrink-0">
                {formatFileSize(metadata.fileSizeBytes)}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-neutral-600 dark:text-neutral-400 mt-0.5">
              <span className="font-mono tabular-nums">{metadata.dimensionsDescription}</span>
              <span aria-hidden="true">·</span>
              {metadata.isA5Estimated ? (
                <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                  Proporsi A5 terdeteksi
                </span>
              ) : (
                <span className="text-amber-700 dark:text-amber-400 font-semibold">
                  Diselaraskan otomatis ke rasio A5
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onReset}
          className="self-start sm:self-center h-8 px-3.5 text-xs font-semibold text-neutral-900 dark:text-neutral-100 bg-white dark:bg-[#1E1E1E] hover:bg-neutral-950 hover:text-white dark:hover:bg-neutral-100 dark:hover:text-neutral-950 border border-neutral-900 dark:border-neutral-600 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Hapus Berkas Ini</span>
        </button>
      </div>

      {/* Flush 4-Column Architectural Stat Strip (No nested cards!) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-neutral-300 dark:divide-neutral-800 bg-[#FAFAF8] dark:bg-[#121212]">
        <div className="p-4 sm:px-5">
          <div className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
            Halaman Asli
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-neutral-950 dark:text-white mt-1">
            {metadata.originalPageCount}{' '}
            <span className="text-xs font-sans font-normal text-neutral-500 dark:text-neutral-400">hlm</span>
          </div>
        </div>

        <div className="p-4 sm:px-5">
          <div className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
            Total Booklet
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-neutral-950 dark:text-white mt-1">
            {metadata.paddedPageCount}{' '}
            <span className="text-xs font-sans font-normal text-neutral-500 dark:text-neutral-400">kelipatan 4</span>
          </div>
        </div>

        <div className="p-4 sm:px-5">
          <div className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
            Halaman Kosong
          </div>
          <div className="text-xl font-bold font-mono tabular-nums mt-1">
            {metadata.blankPagesAdded > 0 ? (
              <span className="text-amber-700 dark:text-amber-400">+{metadata.blankPagesAdded} hlm</span>
            ) : (
              <span className="text-emerald-700 dark:text-emerald-400">0 hlm</span>
            )}
          </div>
        </div>

        <div className="p-4 sm:px-5 bg-neutral-950 dark:bg-[#1E1E1E] text-white">
          <div className="text-xs text-neutral-400 font-medium">
            Kertas A4 Fisik
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-white mt-1">
            {metadata.totalSheets}{' '}
            <span className="text-xs font-sans font-normal text-neutral-300">lembar</span>
          </div>
        </div>
      </div>
    </div>
  );
};
