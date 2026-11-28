import React from 'react';
import { X, Check, AlertTriangle } from 'lucide-react';

interface PrintGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrintGuideModal: React.FC<PrintGuideModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/75 overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white dark:bg-[#161616] border-2 border-neutral-950 dark:border-neutral-600 my-8 max-h-[90vh] flex flex-col transition-colors">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-neutral-900 dark:border-neutral-700 flex items-center justify-between bg-[#FAFAF8] dark:bg-[#121212]">
          <div>
            <div className="font-mono text-xs font-semibold text-[#D9381E] dark:text-[#F04A2E]">
              Instruksi Cetak Fisik
            </div>
            <h3 className="font-display text-lg font-bold text-neutral-950 dark:text-white mt-0.5">
              Panduan Mencetak Booklet A4 Lanskap
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup panduan cetak"
            className="w-9 h-9 border border-neutral-900 dark:border-neutral-600 bg-white dark:bg-[#1E1E1E] text-neutral-900 dark:text-neutral-100 hover:bg-neutral-950 hover:text-white dark:hover:bg-neutral-100 dark:hover:text-neutral-950 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto divide-y divide-neutral-200 dark:divide-neutral-800 text-neutral-800 dark:text-neutral-200">
          {/* Step 1 */}
          <div className="flex gap-4 pb-5">
            <div className="w-8 h-8 bg-neutral-950 dark:bg-neutral-100 text-white dark:text-neutral-950 font-mono font-bold text-xs flex items-center justify-center shrink-0">
              01
            </div>
            <div>
              <h4 className="font-display text-base font-bold text-neutral-950 dark:text-white mb-1">
                Buka Berkas PDF Hasil Konversi
              </h4>
              <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                Unduh berkas booklet dari Katern, lalu buka di pembaca PDF (Chrome, Edge, Adobe Reader, atau Preview). Tekan{' '}
                <kbd className="px-1.5 py-0.5 bg-[#FAFAF8] dark:bg-[#1E1E1E] border border-neutral-400 dark:border-neutral-600 text-[11px] font-mono">
                  Ctrl + P
                </kbd>{' '}
                (Windows) atau{' '}
                <kbd className="px-1.5 py-0.5 bg-[#FAFAF8] dark:bg-[#1E1E1E] border border-neutral-400 dark:border-neutral-600 text-[11px] font-mono">
                  Cmd + P
                </kbd>{' '}
                (Mac).
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-4 py-5">
            <div className="w-8 h-8 bg-neutral-950 dark:bg-neutral-100 text-white dark:text-neutral-950 font-mono font-bold text-xs flex items-center justify-center shrink-0">
              02
            </div>
            <div className="flex-1">
              <h4 className="font-display text-base font-bold text-neutral-950 dark:text-white mb-2">
                Atur Ukuran Kertas & Orientasi
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 border border-neutral-300 dark:border-neutral-700 divide-y sm:divide-y-0 sm:divide-x divide-neutral-300 dark:divide-neutral-700 text-xs">
                <div className="p-3.5 bg-[#FAFAF8] dark:bg-[#121212]">
                  <div className="font-semibold text-neutral-950 dark:text-white mb-0.5">Ukuran Kertas</div>
                  <div className="text-[#D9381E] dark:text-[#F04A2E] font-mono font-bold">A4 (210 × 297 mm)</div>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">
                    Gunakan kertas HVS A4 standar 70 atau 80 GSM.
                  </p>
                </div>
                <div className="p-3.5 bg-[#FAFAF8] dark:bg-[#121212]">
                  <div className="font-semibold text-neutral-950 dark:text-white mb-0.5">Orientasi</div>
                  <div className="text-[#D9381E] dark:text-[#F04A2E] font-mono font-bold">Lanskap (Landscape)</div>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">
                    Posisi kertas horizontal memanjang.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Step 3 - Crucial Duplex setting */}
          <div className="flex gap-4 py-5">
            <div className="w-8 h-8 bg-[#D9381E] text-white font-mono font-bold text-xs flex items-center justify-center shrink-0">
              03
            </div>
            <div className="flex-1">
              <h4 className="font-display text-base font-bold text-neutral-950 dark:text-white mb-1">
                Pengaturan Cetak Dua Sisi (Duplex) — Wajib Diperhatikan
              </h4>
              <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed mb-3">
                Aktifkan <strong>Cetak Dua Sisi / Bolak-Balik (Print on both sides)</strong> pada dialog printer Anda:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Correct Choice */}
                <div className="p-3.5 bg-emerald-50/70 dark:bg-emerald-950/30 border-2 border-emerald-700 dark:border-emerald-500">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-300 mb-1">
                    <Check className="w-4 h-4 shrink-0" />
                    <span>Benar: Flip on Short Edge</span>
                  </div>
                  <p className="text-xs text-neutral-800 dark:text-neutral-200 leading-relaxed">
                    Bahasa Indonesia: <strong>&ldquo;Balik pada tepi pendek&rdquo;</strong>.
                  </p>
                  <p className="text-[11px] text-emerald-800 dark:text-emerald-400 mt-1.5">
                    Halaman depan dan belakang tercetak tegak searah saat dilipat.
                  </p>
                </div>

                {/* Incorrect Choice */}
                <div className="p-3.5 bg-red-50/70 dark:bg-red-950/30 border border-red-700 dark:border-red-500">
                  <div className="flex items-center gap-1.5 font-bold text-red-800 dark:text-red-300 mb-1">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Hindari: Flip on Long Edge</span>
                  </div>
                  <p className="text-xs text-neutral-800 dark:text-neutral-200 leading-relaxed">
                    Bahasa Indonesia: <em>&ldquo;Balik pada tepi panjang&rdquo;</em>.
                  </p>
                  <p className="text-[11px] text-red-800 dark:text-red-400 mt-1.5">
                    Sisi belakang kertas akan tercetak terbalik 180 derajat.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex gap-4 pt-5">
            <div className="w-8 h-8 bg-neutral-950 dark:bg-neutral-100 text-white dark:text-neutral-950 font-mono font-bold text-xs flex items-center justify-center shrink-0">
              04
            </div>
            <div>
              <h4 className="font-display text-base font-bold text-neutral-950 dark:text-white mb-1.5">
                Melipat & Menjilid Kertas (Finishing)
              </h4>
              <ol className="space-y-1.5 text-xs text-neutral-700 dark:text-neutral-300 list-decimal list-inside leading-relaxed">
                <li>
                  <strong>Urutkan:</strong> Susun kertas mulai dari Lembar 1 di bagian paling bawah/luar, disusul Lembar 2, 3, dan seterusnya di bagian dalam.
                </li>
                <li>
                  <strong>Lipat:</strong> Lipat tumpukan kertas tepat pada sumbu tengah vertikal lalu tekan punggung buku dengan penggaris.
                </li>
                <li>
                  <strong>Staples Tengah:</strong> Pasang 2 buah staples di garis lipatan tengah menggunakan stapler jilid panjang (saddle-stitch).
                </li>
              </ol>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:px-6 border-t border-neutral-900 dark:border-neutral-700 bg-[#FAFAF8] dark:bg-[#121212] flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-neutral-950 dark:bg-neutral-100 hover:bg-neutral-800 dark:hover:bg-neutral-200 text-white dark:text-neutral-950 text-xs font-semibold transition-colors cursor-pointer"
          >
            Tutup Panduan
          </button>
        </div>
      </div>
    </div>
  );
};
