import React, { useState } from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';

export const FoldingGuideSection: React.FC = () => {
  const [spreadStep, setSpreadStep] = useState(0);

  // Simulated 8-page book walkthrough
  const spreads = [
    {
      title: 'Sampul Depan (Buku Tertutup)',
      description: 'Halaman 1 berada di sisi depan sampul. Di sisi belakang buku adalah Halaman 8.',
      leftPage: { num: 8, label: 'Sampul Belakang' },
      rightPage: { num: 1, label: 'Sampul Depan' },
      originSheet: 'Lembar 1 (Sisi Depan)',
    },
    {
      title: 'Buka Pertama (Halaman 2 & 3)',
      description: 'Saat sampul dibuka, Halaman 2 dan Halaman 3 saling berhadapan secara berurutan.',
      leftPage: { num: 2, label: 'Halaman Isi' },
      rightPage: { num: 3, label: 'Halaman Isi' },
      originSheet: 'Hal 2 dari Lembar 1 Balik · Hal 3 dari Lembar 2 Depan',
    },
    {
      title: 'Lipatan Tengah / Inti Buku (Centerfold)',
      description: 'Titik terdalam tempat kawat staples penjilid dipasang. Halaman 4 dan 5 berdampingan.',
      leftPage: { num: 4, label: 'Inti Buku' },
      rightPage: { num: 5, label: 'Inti Buku' },
      originSheet: 'Lembar 2 (Sisi Belakang)',
    },
    {
      title: 'Buka Menuju Belakang (Halaman 6 & 7)',
      description: 'Halaman 6 dan Halaman 7 saling berhadapan sebelum sampul belakang ditutup.',
      leftPage: { num: 6, label: 'Halaman Isi' },
      rightPage: { num: 7, label: 'Halaman Isi' },
      originSheet: 'Hal 6 dari Lembar 2 Depan · Hal 7 dari Lembar 1 Balik',
    },
  ];

  const current = spreads[spreadStep];

  return (
    <section className="bg-white dark:bg-[#161616] border border-neutral-900 dark:border-neutral-700 transition-colors">
      {/* Section Header */}
      <div className="p-6 sm:p-8 border-b border-neutral-900 dark:border-neutral-700 flex flex-col md:flex-row md:items-end justify-between gap-5 bg-[#FAFAF8] dark:bg-[#121212]">
        <div>
          <div className="font-mono text-xs font-semibold text-[#D9381E] dark:text-[#F04A2E] mb-1.5">
            Simulasi Pelipatan Saddle-Stitch
          </div>
          <h2 className="font-display text-2xl font-bold text-neutral-950 dark:text-white tracking-tight text-balance">
            Cara Lembaran A4 Dilipat Menjadi Buku A5
          </h2>
          <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 mt-1.5 max-w-2xl leading-relaxed">
            Algoritma imposisi 2-up memasangkan halaman luar dan dalam secara presisi sehingga seluruh isi buku langsung berurutan setelah dilipat dua.
          </p>
        </div>

        {/* Boxy Step Tabs */}
        <div className="flex border border-neutral-900 dark:border-neutral-600 self-start md:self-auto text-xs font-semibold shrink-0">
          {spreads.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setSpreadStep(i)}
              className={`px-3.5 py-2 transition-colors whitespace-nowrap cursor-pointer ${
                i > 0 ? 'border-l border-neutral-900 dark:border-neutral-600' : ''
              } ${
                spreadStep === i
                  ? 'bg-neutral-950 dark:bg-neutral-100 text-white dark:text-neutral-950'
                  : 'bg-white dark:bg-[#1E1E1E] text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              0{i + 1}
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Spread Simulator */}
      <div className="p-6 sm:p-8 bg-[#ECECE8] dark:bg-[#0D0D0D] prepress-grid">
        <div className="max-w-2xl mx-auto bg-white dark:bg-[#161616] p-5 sm:p-7 border border-neutral-900 dark:border-neutral-600">
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 pb-4 border-b border-neutral-200 dark:border-neutral-800">
            <div>
              <div className="text-xs font-mono text-neutral-500 dark:text-neutral-400 tabular-nums">
                Tahap {spreadStep + 1} / {spreads.length}
              </div>
              <h3 className="font-display text-base font-bold text-neutral-950 dark:text-white mt-0.5">
                {current.title}
              </h3>
            </div>
            <div className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400 sm:text-right">
              {current.originSheet}
            </div>
          </div>

          {/* Book Open Graphic */}
          <div className="my-6">
            <div className="w-full flex items-stretch border border-neutral-900 dark:border-neutral-600 bg-white dark:bg-[#161616]">
              {/* Left Page */}
              <div className="flex-1 p-5 sm:p-7 bg-[#FAFAF8] dark:bg-[#121212] border-r border-neutral-300 dark:border-neutral-800 flex flex-col justify-between aspect-[1/1.414]">
                <div className="flex justify-between items-center text-[11px] text-neutral-500 font-mono">
                  <span>Kiri</span>
                  <span>{current.leftPage.label}</span>
                </div>
                <div className="text-center my-auto">
                  <div className="font-mono text-4xl sm:text-5xl font-bold text-neutral-900 dark:text-neutral-100 tabular-nums">
                    {current.leftPage.num}
                  </div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1.5">
                    {current.leftPage.label}
                  </div>
                </div>
                <div className="text-center text-[11px] text-neutral-400 font-mono tabular-nums">
                  Hal {current.leftPage.num}
                </div>
              </div>

              {/* Spine crease / Staples line */}
              <div className="w-2 bg-neutral-200 dark:bg-neutral-800 border-x border-neutral-300 dark:border-neutral-700 flex flex-col justify-around items-center">
                <div className="w-2.5 h-1 bg-neutral-900 dark:bg-neutral-300" title="Kawat Staples" />
                <div className="w-2.5 h-1 bg-neutral-900 dark:bg-neutral-300" title="Kawat Staples" />
              </div>

              {/* Right Page */}
              <div className="flex-1 p-5 sm:p-7 bg-white dark:bg-[#161616] flex flex-col justify-between aspect-[1/1.414]">
                <div className="flex justify-between items-center text-[11px] text-neutral-500 font-mono">
                  <span>{current.rightPage.label}</span>
                  <span>Kanan</span>
                </div>
                <div className="text-center my-auto">
                  <div className="font-mono text-4xl sm:text-5xl font-bold text-[#D9381E] dark:text-[#F04A2E] tabular-nums">
                    {current.rightPage.num}
                  </div>
                  <div className="text-xs text-neutral-700 dark:text-neutral-300 font-medium mt-1.5">
                    {current.rightPage.label}
                  </div>
                </div>
                <div className="text-center text-[11px] text-neutral-400 font-mono tabular-nums">
                  Hal {current.rightPage.num}
                </div>
              </div>
            </div>
          </div>

          <p className="text-xs text-neutral-700 dark:text-neutral-300 text-center leading-relaxed">
            {current.description}
          </p>

          {/* Stepper Buttons */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-neutral-200 dark:border-neutral-800">
            <button
              type="button"
              onClick={() => setSpreadStep((prev) => Math.max(0, prev - 1))}
              disabled={spreadStep === 0}
              className="h-9 px-3.5 text-xs font-semibold border border-neutral-900 dark:border-neutral-600 bg-white dark:bg-[#1E1E1E] text-neutral-900 dark:text-neutral-100 disabled:opacity-35 disabled:pointer-events-none hover:bg-neutral-950 hover:text-white dark:hover:bg-neutral-100 dark:hover:text-neutral-950 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Sebelumnya</span>
            </button>

            <span className="text-xs text-neutral-600 dark:text-neutral-400 font-mono tabular-nums">
              Hal {current.leftPage.num} & Hal {current.rightPage.num}
            </span>

            <button
              type="button"
              onClick={() => setSpreadStep((prev) => Math.min(spreads.length - 1, prev + 1))}
              disabled={spreadStep === spreads.length - 1}
              className="h-9 px-3.5 text-xs font-semibold border border-neutral-900 dark:border-neutral-600 bg-white dark:bg-[#1E1E1E] text-neutral-900 dark:text-neutral-100 disabled:opacity-35 disabled:pointer-events-none hover:bg-neutral-950 hover:text-white dark:hover:bg-neutral-100 dark:hover:text-neutral-950 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>Berikutnya</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
