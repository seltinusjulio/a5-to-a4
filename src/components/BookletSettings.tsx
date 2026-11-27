import React from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
} from 'lucide-react';
import {
  BookletOptions,
  SourceDimensionPreset,
} from '../types/booklet';

interface BookletSettingsProps {
  options: BookletOptions;
  onChangeOptions: (updated: BookletOptions) => void;
  blankPagesAdded: number;
  detectedDimensions?: { widthMm: number; heightMm: number; description: string };
}

export const BookletSettings: React.FC<BookletSettingsProps> = ({
  options,
  onChangeOptions,
  blankPagesAdded,
  detectedDimensions,
}) => {
  const handlePresetChange = (preset: SourceDimensionPreset) => {
    let customW = options.customSourceWidthMm || 148;
    let customH = options.customSourceHeightMm || 210;

    if (preset === 'a5') {
      customW = 148;
      customH = 210;
    } else if (preset === 'half-letter') {
      customW = 140;
      customH = 216;
    } else if (preset === 'a4') {
      customW = 210;
      customH = 297;
    } else if (preset === 'letter') {
      customW = 216;
      customH = 279;
    } else if (preset === 'auto' && detectedDimensions) {
      customW = detectedDimensions.widthMm;
      customH = detectedDimensions.heightMm;
    }

    onChangeOptions({
      ...options,
      sourceDimensionPreset: preset,
      customSourceWidthMm: customW,
      customSourceHeightMm: customH,
    });
  };

  const handleCustomDimensionChange = (key: 'customSourceWidthMm' | 'customSourceHeightMm', val: number) => {
    onChangeOptions({
      ...options,
      [key]: Math.max(10, val),
    });
  };

  const handleOuterMarginChange = (val: number) => {
    const clamped = Math.max(0, Math.min(25, val));
    onChangeOptions({
      ...options,
      outerMarginMm: clamped,
      marginMm: clamped,
    });
  };

  const handleGutterMarginChange = (val: number) => {
    const clamped = Math.max(0, Math.min(20, val));
    onChangeOptions({
      ...options,
      gutterMarginMm: clamped,
    });
  };

  const activeBtnClass =
    'bg-neutral-950 dark:bg-neutral-100 text-white dark:text-neutral-950 border-neutral-950 dark:border-neutral-100 font-semibold';
  const inactiveBtnClass =
    'bg-white dark:bg-[#1B1B1B] text-neutral-800 dark:text-neutral-300 border-neutral-300 dark:border-neutral-700 hover:border-neutral-900 dark:hover:border-neutral-400';

  return (
    <div className="bg-white dark:bg-[#161616] border border-neutral-900 dark:border-neutral-700 transition-colors">
      {/* Panel Header */}
      <div className="px-5 py-3.5 border-b border-neutral-900 dark:border-neutral-700 flex items-center justify-between bg-[#FAFAF8] dark:bg-[#121212]">
        <h3 className="font-display text-sm font-bold text-neutral-950 dark:text-white">
          Pengaturan Tata Letak
        </h3>
        <span className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
          Target: A4 Lanskap
        </span>
      </div>

      <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
        {/* 1. SOURCE PAGE DIMENSIONS */}
        <div className="p-5">
          <div className="flex items-center justify-between gap-2 text-xs mb-2.5">
            <span className="font-bold text-neutral-900 dark:text-neutral-100">
              Dimensi Halaman Sumber
            </span>
            {detectedDimensions && (
              <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-mono tabular-nums">
                {detectedDimensions.widthMm} × {detectedDimensions.heightMm} mm
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-1.5 text-xs">
            {[
              { id: 'auto', label: 'Otomatis', sub: 'Dari PDF' },
              { id: 'a5', label: 'A5', sub: '148 × 210' },
              { id: 'half-letter', label: 'Half-Letter', sub: '140 × 216' },
              { id: 'a4', label: 'A4 Potret', sub: 'Skala A5' },
              { id: 'letter', label: 'US Letter', sub: 'Skala A5' },
              { id: 'custom', label: 'Kustom', sub: 'Input mm' },
            ].map((item) => {
              const isSelected = options.sourceDimensionPreset === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handlePresetChange(item.id as SourceDimensionPreset)}
                  className={`p-2 border text-left transition-colors cursor-pointer ${
                    isSelected ? activeBtnClass : inactiveBtnClass
                  }`}
                >
                  <div className="text-xs leading-tight">{item.label}</div>
                  <div
                    className={`text-[10px] mt-0.5 font-mono tabular-nums ${
                      isSelected
                        ? 'text-neutral-300 dark:text-neutral-600'
                        : 'text-neutral-500 dark:text-neutral-400'
                    }`}
                  >
                    {item.sub}
                  </div>
                </button>
              );
            })}
          </div>

          {options.sourceDimensionPreset === 'custom' && (
            <div className="mt-3 p-3 bg-[#FAFAF8] dark:bg-[#121212] border border-neutral-300 dark:border-neutral-700 grid grid-cols-2 gap-2.5 text-xs">
              <div>
                <label className="text-neutral-700 dark:text-neutral-300 block mb-1 font-medium">
                  Lebar (mm)
                </label>
                <input
                  type="number"
                  min="50"
                  max="400"
                  value={options.customSourceWidthMm}
                  onChange={(e) =>
                    handleCustomDimensionChange('customSourceWidthMm', parseFloat(e.target.value) || 148)
                  }
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-[#1E1E1E] border border-neutral-400 dark:border-neutral-600 font-mono text-xs tabular-nums text-neutral-950 dark:text-white focus:outline-none focus:border-neutral-950 dark:focus:border-white"
                />
              </div>
              <div>
                <label className="text-neutral-700 dark:text-neutral-300 block mb-1 font-medium">
                  Tinggi (mm)
                </label>
                <input
                  type="number"
                  min="50"
                  max="400"
                  value={options.customSourceHeightMm}
                  onChange={(e) =>
                    handleCustomDimensionChange('customSourceHeightMm', parseFloat(e.target.value) || 210)
                  }
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-[#1E1E1E] border border-neutral-400 dark:border-neutral-600 font-mono text-xs tabular-nums text-neutral-950 dark:text-white focus:outline-none focus:border-neutral-950 dark:focus:border-white"
                />
              </div>
            </div>
          )}
        </div>

        {/* 2. CUSTOM MARGINS & SPACING */}
        <div className="p-5 space-y-4 text-xs">
          <div>
            <div className="flex items-center justify-between font-bold text-neutral-900 dark:text-neutral-100 mb-2">
              <span>Margin Luar Kertas A4</span>
              <span className="font-mono text-[#D9381E] dark:text-[#F04A2E] tabular-nums">
                {options.outerMarginMm} mm
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="20"
              step="1"
              value={options.outerMarginMm}
              onChange={(e) => handleOuterMarginChange(parseInt(e.target.value))}
              className="w-full cursor-pointer"
            />
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1.5">
              Batas tepi atas, bawah, dan sisi luar kertas agar tidak terpotong printer.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between font-bold text-neutral-900 dark:text-neutral-100 mb-2">
              <span>Margin Punggung (Spine Gutter)</span>
              <span className="font-mono text-[#D9381E] dark:text-[#F04A2E] tabular-nums">
                {options.gutterMarginMm} mm
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="15"
              step="1"
              value={options.gutterMarginMm}
              onChange={(e) => handleGutterMarginChange(parseInt(e.target.value))}
              className="w-full cursor-pointer"
            />
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1.5">
              Ruang ekstra di sekitar garis lipat tengah untuk staples dan kelenturan buku.
            </p>
          </div>
        </div>

        {/* 3. SCALING & ALIGNMENT */}
        <div className="p-5 space-y-4 text-xs">
          <div>
            <span className="font-bold text-neutral-900 dark:text-neutral-100 block mb-2">
              Skala Ukuran Halaman
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => onChangeOptions({ ...options, scaleMode: 'fit' })}
                className={`py-2 px-2.5 border text-center transition-colors cursor-pointer ${
                  options.scaleMode === 'fit' ? activeBtnClass : inactiveBtnClass
                }`}
              >
                Pas Margin (Fit)
              </button>
              <button
                type="button"
                onClick={() => onChangeOptions({ ...options, scaleMode: 'actual' })}
                className={`py-2 px-2.5 border text-center transition-colors cursor-pointer ${
                  options.scaleMode === 'actual' ? activeBtnClass : inactiveBtnClass
                }`}
              >
                Ukuran Asli 100%
              </button>
            </div>
          </div>

          <div>
            <span className="font-bold text-neutral-900 dark:text-neutral-100 block mb-2">
              Penyelarasan Horisontal
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: 'center', label: 'Tengah', icon: AlignCenter },
                { id: 'spine', label: 'Punggung', icon: AlignRight },
                { id: 'outer', label: 'Tepi Luar', icon: AlignLeft },
              ].map((align) => {
                const Icon = align.icon;
                const isSelected = options.alignment === align.id;
                return (
                  <button
                    key={align.id}
                    type="button"
                    onClick={() =>
                      onChangeOptions({
                        ...options,
                        alignment: align.id as 'center' | 'spine' | 'outer',
                      })
                    }
                    className={`py-2 px-2 border flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      isSelected ? activeBtnClass : inactiveBtnClass
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{align.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 4. BLANK PAGES PLACEMENT */}
        <div className="p-5 text-xs">
          <div className="flex items-center justify-between font-bold text-neutral-900 dark:text-neutral-100 mb-2">
            <span>Penempatan Halaman Kosong</span>
            {blankPagesAdded > 0 && (
              <span className="font-mono text-amber-700 dark:text-amber-400 tabular-nums">
                +{blankPagesAdded} hlm
              </span>
            )}
          </div>
          <div className="space-y-1.5">
            <label
              className={`flex items-start gap-2.5 p-2.5 border cursor-pointer transition-colors ${
                options.blankPlacement === 'end'
                  ? 'border-neutral-950 dark:border-neutral-200 bg-[#FAFAF8] dark:bg-[#1E1E1E]'
                  : 'border-neutral-300 dark:border-neutral-700 hover:border-neutral-600 dark:hover:border-neutral-500'
              }`}
            >
              <input
                type="radio"
                name="blankPlacement"
                value="end"
                checked={options.blankPlacement === 'end'}
                onChange={() => onChangeOptions({ ...options, blankPlacement: 'end' })}
                className="mt-0.5 accent-neutral-950 dark:accent-white"
              />
              <div>
                <div className="font-semibold text-xs text-neutral-950 dark:text-white">
                  Di Akhir Dokumen
                </div>
                <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Halaman kosong ditaruh di lembar paling belakang.
                </div>
              </div>
            </label>

            <label
              className={`flex items-start gap-2.5 p-2.5 border cursor-pointer transition-colors ${
                options.blankPlacement === 'before-back-cover'
                  ? 'border-neutral-950 dark:border-neutral-200 bg-[#FAFAF8] dark:bg-[#1E1E1E]'
                  : 'border-neutral-300 dark:border-neutral-700 hover:border-neutral-600 dark:hover:border-neutral-500'
              }`}
            >
              <input
                type="radio"
                name="blankPlacement"
                value="before-back-cover"
                checked={options.blankPlacement === 'before-back-cover'}
                onChange={() => onChangeOptions({ ...options, blankPlacement: 'before-back-cover' })}
                className="mt-0.5 accent-neutral-950 dark:accent-white"
              />
              <div>
                <div className="font-semibold text-xs text-neutral-950 dark:text-white">
                  Sebelum Sampul Belakang
                </div>
                <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Halaman terakhir tetap menjadi sampul belakang buku.
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* 5. PDF COMPRESSION & IMAGE OPTIMIZATION */}
        <div className="p-5 text-xs">
          <div className="flex items-center justify-between font-bold text-neutral-900 dark:text-neutral-100 mb-2">
            <span>Kompresi & Optimasi PDF</span>
            <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400">
              {options.compressionLevel === 'balanced'
                ? 'Hemat ~50-70%'
                : options.compressionLevel === 'compact'
                ? 'Ukuran Terkecil'
                : options.compressionLevel === 'standard'
                ? 'Lossless'
                : 'Asli'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { id: 'balanced', label: 'Seimbang', desc: '~200 DPI, tajam dicetak' },
              { id: 'compact', label: 'Sangat Ringan', desc: '~150 DPI, ukuran kecil' },
              { id: 'standard', label: 'Lossless', desc: 'Kompresi objek stream' },
              { id: 'none', label: 'Tanpa Kompresi', desc: 'Ukuran asli sumber' },
            ].map((lvl) => {
              const isSelected = options.compressionLevel === lvl.id;
              return (
                <button
                  key={lvl.id}
                  type="button"
                  onClick={() => onChangeOptions({ ...options, compressionLevel: lvl.id as any })}
                  className={`p-2.5 border text-left transition-colors cursor-pointer ${
                    isSelected ? activeBtnClass : inactiveBtnClass
                  }`}
                >
                  <div className="text-xs leading-tight">{lvl.label}</div>
                  <div
                    className={`text-[10px] mt-0.5 ${
                      isSelected
                        ? 'text-neutral-300 dark:text-neutral-600'
                        : 'text-neutral-500 dark:text-neutral-400'
                    }`}
                  >
                    {lvl.desc}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 6. AUTO-CROP WHITE MARGINS */}
        <div className="p-5 text-xs">
          <label className="flex items-start justify-between gap-3 cursor-pointer">
            <div>
              <div className="font-bold text-neutral-900 dark:text-neutral-100">
                Potong Margin Putih Otomatis (Auto-Crop)
                {options.autoCropWhiteMargins && (
                  <span className="ml-2 font-mono text-[11px] text-emerald-700 dark:text-emerald-400">
                    · Aktif
                  </span>
                )}
              </div>
              <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 leading-normal">
                Memangkas batas putih tidak seragam agar teks mengisi bidang booklet secara simetris.
              </div>
            </div>
            <input
              type="checkbox"
              checked={Boolean(options.autoCropWhiteMargins)}
              onChange={() =>
                onChangeOptions({
                  ...options,
                  autoCropWhiteMargins: !options.autoCropWhiteMargins,
                  cropPaddingMm: options.cropPaddingMm ?? 3,
                  cropThreshold: options.cropThreshold ?? 245,
                })
              }
              className="w-4 h-4 mt-0.5 accent-neutral-950 dark:accent-white cursor-pointer shrink-0"
            />
          </label>

          {options.autoCropWhiteMargins && (
            <div className="mt-3.5 p-3.5 bg-[#FAFAF8] dark:bg-[#121212] border border-neutral-300 dark:border-neutral-700 space-y-3.5">
              <div>
                <div className="flex items-center justify-between font-bold text-neutral-900 dark:text-neutral-100 mb-1.5">
                  <span>Bantalan Tepi Konten</span>
                  <span className="font-mono text-[#D9381E] dark:text-[#F04A2E] tabular-nums">
                    {options.cropPaddingMm ?? 3} mm
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="1"
                  value={options.cropPaddingMm ?? 3}
                  onChange={(e) =>
                    onChangeOptions({
                      ...options,
                      cropPaddingMm: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full cursor-pointer"
                />
              </div>

              <div>
                <span className="font-bold text-neutral-900 dark:text-neutral-100 block mb-1.5">
                  Kepekaan Deteksi Putih (Threshold)
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { val: 235, label: 'Sensitif', desc: 'Scan' },
                    { val: 245, label: 'Standar', desc: 'Default' },
                    { val: 252, label: 'Ketat', desc: '100% Putih' },
                  ].map((th) => {
                    const isSelected = (options.cropThreshold ?? 245) === th.val;
                    return (
                      <button
                        key={th.val}
                        type="button"
                        onClick={() =>
                          onChangeOptions({
                            ...options,
                            cropThreshold: th.val,
                          })
                        }
                        className={`py-1.5 px-2 border text-center transition-colors cursor-pointer ${
                          isSelected ? activeBtnClass : inactiveBtnClass
                        }`}
                      >
                        <div className="text-[11px]">{th.label}</div>
                        <div
                          className={`text-[9px] font-mono ${
                            isSelected
                              ? 'text-neutral-300 dark:text-neutral-600'
                              : 'text-neutral-500 dark:text-neutral-400'
                          }`}
                        >
                          {th.desc}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 7. FOLD LINE GUIDE */}
        <div className="p-5 text-xs">
          <label className="flex items-start justify-between gap-3 cursor-pointer">
            <div>
              <div className="font-bold text-neutral-900 dark:text-neutral-100">
                Garis Panduan Lipat & Tanda Potong
              </div>
              <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                Cetak garis putus-putus samar dan penanda lipat di sumbu tengah A4.
              </div>
            </div>
            <input
              type="checkbox"
              checked={options.showFoldLine}
              onChange={() =>
                onChangeOptions({ ...options, showFoldLine: !options.showFoldLine })
              }
              className="w-4 h-4 mt-0.5 accent-neutral-950 dark:accent-white cursor-pointer shrink-0"
            />
          </label>
        </div>
      </div>
    </div>
  );
};
