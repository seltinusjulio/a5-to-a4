import React, { useState, useRef } from 'react';
import { Upload, AlertCircle, Files, FileText } from 'lucide-react';
import { useToast } from '../context/ToastContext';

interface UploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  onUseSample: () => void;
  isLoading: boolean;
  loadingMessage?: string;
  errorMessage?: string | null;
  compact?: boolean;
}

export const UploadZone: React.FC<UploadZoneProps> = ({
  onFilesSelected,
  onUseSample,
  isLoading,
  loadingMessage,
  errorMessage,
  compact = false,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const { showError, showWarning } = useToast();

  const validateAndFilterFiles = (fileList: FileList | File[]): File[] => {
    const filesArray = Array.from(fileList);
    const validFiles: File[] = [];
    const MAX_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB limit

    let invalidTypeCount = 0;
    let oversizeCount = 0;
    let emptyCount = 0;

    for (const file of filesArray) {
      const isPdf =
        file.type === 'application/pdf' ||
        file.name.toLowerCase().endsWith('.pdf');

      if (!isPdf) {
        invalidTypeCount++;
        continue;
      }

      if (file.size === 0) {
        emptyCount++;
        continue;
      }

      if (file.size > MAX_SIZE_BYTES) {
        oversizeCount++;
        continue;
      }

      validFiles.push(file);
    }

    if (invalidTypeCount > 0) {
      showError(
        'Format Berkas Ditolak',
        `${invalidTypeCount} berkas bukan format PDF (.pdf) dan dilewati.`
      );
    }

    if (oversizeCount > 0) {
      showError(
        'Ukuran Berkas Melebihi Batas',
        `${oversizeCount} berkas berukuran lebih dari 100 MB. Batas maksimal peramban adalah 100 MB.`
      );
    }

    if (emptyCount > 0) {
      showWarning(
        'Berkas Kosong',
        `${emptyCount} berkas berukuran 0 byte dan tidak dapat diproses.`
      );
    }

    return validFiles;
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const validFiles = validateAndFilterFiles(e.dataTransfer.files);
      if (validFiles.length > 0) {
        onFilesSelected(validFiles);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const validFiles = validateAndFilterFiles(e.target.files);
      if (validFiles.length > 0) {
        onFilesSelected(validFiles);
      }
      e.target.value = '';
    }
  };

  if (compact) {
    return (
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isLoading && fileInputRef.current?.click()}
        className={`border border-dashed p-4 text-center cursor-pointer transition-colors ${
          isDragOver
            ? 'border-[#D9381E] bg-red-50/50 dark:bg-red-950/20'
            : 'border-neutral-400 dark:border-neutral-700 hover:border-neutral-900 dark:hover:border-neutral-400 bg-white dark:bg-[#161616]'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          multiple
          className="hidden"
          onChange={handleFileChange}
          disabled={isLoading}
        />
        <div className="flex items-center justify-center gap-2 text-xs font-semibold text-neutral-900 dark:text-neutral-100">
          <Files className="w-4 h-4" />
          <span>Tambah File PDF Lainnya (Pilih Banyak Sekaligus)</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Unified Architectural Frame: Dropzone + Flush Spec Strip */}
      <div className="border border-neutral-900 dark:border-neutral-700 bg-white dark:bg-[#161616]">
        {/* Drop Zone Box */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !isLoading && fileInputRef.current?.click()}
          className={`relative p-8 sm:p-12 transition-colors cursor-pointer prepress-grid ${
            isDragOver
              ? 'bg-[#D9381E]/8 dark:bg-[#F04A2E]/10'
              : 'bg-white dark:bg-[#161616] hover:bg-neutral-50/90 dark:hover:bg-[#1B1B1B]'
          } ${isLoading ? 'pointer-events-none opacity-80' : ''}`}
        >
          {/* Corner registration crop marks */}
          <span aria-hidden="true" className="absolute top-3 left-3 w-3 h-3 border-t-2 border-l-2 border-neutral-900 dark:border-neutral-500" />
          <span aria-hidden="true" className="absolute top-3 right-3 w-3 h-3 border-t-2 border-r-2 border-neutral-900 dark:border-neutral-500" />
          <span aria-hidden="true" className="absolute bottom-3 left-3 w-3 h-3 border-b-2 border-l-2 border-neutral-900 dark:border-neutral-500" />
          <span aria-hidden="true" className="absolute bottom-3 right-3 w-3 h-3 border-b-2 border-r-2 border-neutral-900 dark:border-neutral-500" />

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            multiple
            className="hidden"
            onChange={handleFileChange}
            disabled={isLoading}
          />

          {isLoading ? (
            <div className="py-10 flex flex-col items-center justify-center text-center">
              <div className="w-8 h-8 border-2 border-neutral-900 dark:border-white border-t-transparent animate-spin mb-4" />
              <p className="text-sm font-bold text-neutral-950 dark:text-white">
                {loadingMessage || 'Memproses berkas PDF...'}
              </p>
              <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1 font-mono">
                Menghitung susunan halaman dan menyiapkan imposisi 2-up...
              </p>
            </div>
          ) : (
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8 py-2">
              <div className="max-w-xl">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 border border-neutral-900 dark:border-neutral-600 bg-neutral-950 dark:bg-neutral-100 text-white dark:text-neutral-950 flex items-center justify-center shrink-0">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div className="text-xs font-mono text-neutral-600 dark:text-neutral-400">
                    Format .PDF · Maks. 100 MB per berkas
                  </div>
                </div>

                <h2 className="font-display text-2xl sm:text-3xl font-bold text-neutral-950 dark:text-white tracking-tight text-balance">
                  Tarik dan letakkan berkas PDF di area ini
                </h2>
                <p className="text-sm text-neutral-600 dark:text-neutral-300 mt-2.5 leading-relaxed">
                  Mendukung impor banyak berkas sekaligus (batch) untuk ukuran A5, A4, Letter, maupun dimensi kustom. Seluruh proses berlangsung lokal di peramban Anda.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="px-6 py-3 bg-[#D9381E] hover:bg-[#B82B14] active:bg-[#99220F] text-white text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 dark:focus-visible:outline-white flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
                >
                  <Files className="w-4 h-4" />
                  <span>Pilih Berkas PDF</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUseSample();
                  }}
                  className="px-6 py-3 bg-white dark:bg-[#1E1E1E] hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-900 dark:text-neutral-100 text-sm font-semibold border border-neutral-900 dark:border-neutral-600 transition-colors flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
                >
                  <FileText className="w-4 h-4" />
                  <span>Muat Contoh A5 (8 Halaman)</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Flush 3-column specification strip — zero floating gap, shared 1px dividers */}
        <div className="grid grid-cols-1 md:grid-cols-3 border-t border-neutral-900 dark:border-neutral-700 divide-y md:divide-y-0 md:divide-x divide-neutral-300 dark:divide-neutral-800 bg-[#FAFAF8] dark:bg-[#121212]">
          <div className="p-5 sm:p-6">
            <div className="font-mono text-xs font-semibold text-[#D9381E] dark:text-[#F04A2E] mb-2">
              01. Dimensi & Margin
            </div>
            <h3 className="text-sm font-bold text-neutral-950 dark:text-white mb-1">
              Margin Luar, Spine Gutter & Auto-Crop
            </h3>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
              Atur batas luar, ruang lipatan punggung buku, serta pemotongan margin putih otomatis agar naskah tidak terpotong staples.
            </p>
          </div>

          <div className="p-5 sm:p-6">
            <div className="font-mono text-xs font-semibold text-[#D9381E] dark:text-[#F04A2E] mb-2">
              02. Pratinjau 2 Mode
            </div>
            <h3 className="text-sm font-bold text-neutral-950 dark:text-white mb-1">
              Lembar Fisik A4 & Simulasi Baca
            </h3>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
              Periksa pasangan halaman muka-belakang tiap lembar kertas A4 atau buka buku halaman demi halaman sebelum dicetak.
            </p>
          </div>

          <div className="p-5 sm:p-6">
            <div className="font-mono text-xs font-semibold text-[#D9381E] dark:text-[#F04A2E] mb-2">
              03. Antrean Batch & Kompresi
            </div>
            <h3 className="text-sm font-bold text-neutral-950 dark:text-white mb-1">
              Unduh Satuan atau Arsip ZIP
            </h3>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
              Konversi beberapa berkas PDF sekaligus, optimasi ukuran gambar agar lebih ringan, lalu ekspor satuan atau dalam satu ZIP.
            </p>
          </div>
        </div>
      </div>

      {/* Error alert if any */}
      {errorMessage && (
        <div className="mt-4 p-4 bg-red-50 dark:bg-red-950/40 border border-red-700 dark:border-red-500 text-red-950 dark:text-red-100 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-700 dark:text-red-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold">Pemberitahuan Berkas</h4>
            <p className="text-xs text-red-800 dark:text-red-200 mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}
    </div>
  );
};
