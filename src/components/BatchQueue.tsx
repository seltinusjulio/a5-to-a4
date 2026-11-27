import React from 'react';
import {
  FileText,
  Download,
  Trash2,
  AlertCircle,
  Eye,
  Archive,
  Plus,
} from 'lucide-react';
import { BatchItem } from '../types/booklet';

interface BatchQueueProps {
  items: BatchItem[];
  activeItemId: string;
  onSelectActiveItem: (id: string) => void;
  onRemoveItem: (id: string) => void;
  onClearAll: () => void;
  onAddMoreFiles: () => void;
  onDownloadItem: (item: BatchItem) => void;
  onDownloadAllZip: () => void;
  isZipping: boolean;
  zipProgress?: { currentFile: string; percentage: number } | null;
}

export const BatchQueue: React.FC<BatchQueueProps> = ({
  items,
  activeItemId,
  onSelectActiveItem,
  onRemoveItem,
  onClearAll,
  onAddMoreFiles,
  onDownloadItem,
  onDownloadAllZip,
  isZipping,
  zipProgress,
}) => {
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const readyItemsCount = items.filter((it) => it.loadedDoc && it.imposition).length;

  return (
    <div className="bg-white dark:bg-[#161616] border border-neutral-900 dark:border-neutral-700 transition-colors">
      {/* Batch Header Bar */}
      <div className="p-4 sm:px-5 border-b border-neutral-900 dark:border-neutral-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FAFAF8] dark:bg-[#121212]">
        <div>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <h3 className="font-display text-sm font-bold text-neutral-950 dark:text-white">
              Antrean Berkas Batch
            </h3>
            <span className="text-neutral-400 dark:text-neutral-600" aria-hidden="true">·</span>
            <span className="text-xs font-mono tabular-nums text-neutral-600 dark:text-neutral-400">
              {items.length} berkas dimuat
            </span>
            <span className="text-neutral-400 dark:text-neutral-600" aria-hidden="true">·</span>
            <span className="text-xs font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
              {readyItemsCount} siap konversi
            </span>
          </div>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5">
            Pilih baris berkas untuk memeriksa pratinjau lembar, atau unduh semua sekaligus dalam arsip ZIP.
          </p>
        </div>

        {/* Global Batch Actions */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={onAddMoreFiles}
            className="h-8 px-3 text-xs font-semibold text-neutral-900 dark:text-neutral-100 bg-white dark:bg-[#1E1E1E] hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-900 dark:border-neutral-600 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah File</span>
          </button>

          <button
            type="button"
            onClick={onDownloadAllZip}
            disabled={isZipping || readyItemsCount === 0}
            className="h-8 px-3.5 text-xs font-semibold text-white bg-neutral-950 hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-950 dark:hover:bg-neutral-200 border border-neutral-950 dark:border-neutral-100 transition-colors flex items-center gap-1.5 disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap cursor-pointer"
          >
            <Archive className="w-3.5 h-3.5" />
            <span>{isZipping ? 'Mengemas ZIP...' : `Unduh ZIP (${readyItemsCount})`}</span>
          </button>

          <button
            type="button"
            onClick={onClearAll}
            title="Kosongkan seluruh daftar berkas"
            aria-label="Kosongkan seluruh daftar berkas"
            className="h-8 w-8 flex items-center justify-center border border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:text-red-700 dark:hover:text-red-400 hover:border-red-700 dark:hover:border-red-500 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ZIP Progress Bar if running */}
      {isZipping && zipProgress && (
        <div className="px-5 py-3 bg-neutral-100 dark:bg-[#1B1B1B] border-b border-neutral-300 dark:border-neutral-800 text-xs">
          <div className="flex items-center justify-between text-neutral-950 dark:text-neutral-100 font-semibold mb-1.5">
            <span className="truncate">{zipProgress.currentFile}</span>
            <span className="font-mono tabular-nums">{zipProgress.percentage}%</span>
          </div>
          <div className="w-full h-1.5 bg-neutral-300 dark:bg-neutral-800 overflow-hidden">
            <div
              className="h-full bg-[#D9381E] dark:bg-[#F04A2E] transition-all duration-200"
              style={{ width: `${zipProgress.percentage}%` }}
            />
          </div>
        </div>
      )}

      {/* Batch Files List */}
      <div className="divide-y divide-neutral-200 dark:divide-neutral-800 max-h-72 overflow-y-auto">
        {items.map((item, idx) => {
          const isActive = item.id === activeItemId;
          const isReady = item.status === 'ready' || (item.loadedDoc && item.imposition);

          return (
            <div
              key={item.id}
              onClick={() => onSelectActiveItem(item.id)}
              className={`px-4 sm:px-5 py-3 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                isActive
                  ? 'bg-neutral-100 dark:bg-[#222222]'
                  : 'hover:bg-neutral-50 dark:hover:bg-[#1B1B1B] bg-white dark:bg-[#161616]'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-mono text-[11px] tabular-nums text-neutral-400 dark:text-neutral-500 w-5 shrink-0">
                  {String(idx + 1).padStart(2, '0')}
                </span>

                <div
                  className={`w-7 h-7 border flex items-center justify-center shrink-0 ${
                    isActive
                      ? 'bg-[#D9381E] border-[#D9381E] text-white'
                      : 'bg-white dark:bg-[#1E1E1E] border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs truncate max-w-xs sm:max-w-md ${
                        isActive
                          ? 'font-bold text-neutral-950 dark:text-white'
                          : 'text-neutral-900 dark:text-neutral-200 font-medium'
                      }`}
                    >
                      {item.filename}
                    </span>
                    <span className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400 tabular-nums shrink-0">
                      {formatFileSize(item.fileSizeBytes)}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-neutral-600 dark:text-neutral-400 mt-0.5 font-mono tabular-nums">
                    {item.imposition ? (
                      <>
                        <span>{item.imposition.metadata.originalPageCount} hlm</span>
                        <span aria-hidden="true">→</span>
                        <span className="font-semibold text-neutral-900 dark:text-neutral-200">
                          {item.imposition.metadata.totalSheets} lembar A4
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="text-emerald-700 dark:text-emerald-400 font-sans font-semibold">
                          Siap
                        </span>
                      </>
                    ) : item.status === 'processing' ? (
                      <span className="text-neutral-800 dark:text-neutral-200 font-sans flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 border-2 border-neutral-900 dark:border-white border-t-transparent animate-spin inline-block" />
                        Membaca berkas PDF...
                      </span>
                    ) : item.status === 'error' ? (
                      <span className="text-red-700 dark:text-red-400 font-sans flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        {item.errorMessage || 'Gagal memproses berkas'}
                      </span>
                    ) : (
                      <span className="font-sans">Menunggu giliran</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Item Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectActiveItem(item.id);
                  }}
                  className={`h-7 px-2.5 text-xs border transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-neutral-950 dark:bg-neutral-100 border-neutral-950 dark:border-neutral-100 text-white dark:text-neutral-950 font-semibold'
                      : 'bg-white dark:bg-[#1E1E1E] border-neutral-300 dark:border-neutral-700 hover:border-neutral-900 dark:hover:border-neutral-400 text-neutral-700 dark:text-neutral-300'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">
                    {isActive ? 'Aktif' : 'Pratinjau'}
                  </span>
                </button>

                {isReady && (
                  <button
                    type="button"
                    title="Unduh berkas booklet PDF ini"
                    aria-label="Unduh berkas booklet PDF ini"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDownloadItem(item);
                    }}
                    className="h-7 w-7 flex items-center justify-center border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-950 hover:text-white hover:border-neutral-950 dark:hover:bg-white dark:hover:text-neutral-950 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                )}

                <button
                  type="button"
                  title="Hapus berkas dari antrean"
                  aria-label="Hapus berkas dari antrean"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveItem(item.id);
                  }}
                  className="h-7 w-7 flex items-center justify-center border border-neutral-300 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:text-red-700 dark:hover:text-red-400 hover:border-red-700 dark:hover:border-red-500 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
