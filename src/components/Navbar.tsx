import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface NavbarProps {
  onOpenGuide: () => void;
  onOpenFaq: () => void;
  onOpenWorkings: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenGuide,
  onOpenFaq,
  onOpenWorkings,
}) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-30 bg-[#F5F5F3] dark:bg-[#0D0D0D] border-b border-neutral-900 dark:border-neutral-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-8">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="/"
          className="font-display text-lg font-extrabold tracking-tight text-neutral-950 dark:text-white hover:text-[#D9381E] dark:hover:text-[#F04A2E] transition-colors whitespace-nowrap shrink-0"
        >
          BukuCepat
        </a>

        {/* Zone 2: Clean single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-neutral-700 dark:text-neutral-300">
          <button
            type="button"
            onClick={onOpenGuide}
            className="hover:text-neutral-950 dark:hover:text-white hover:underline underline-offset-4 decoration-neutral-950 dark:decoration-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Panduan Cetak
          </button>
          <button
            type="button"
            onClick={onOpenWorkings}
            className="hover:text-neutral-950 dark:hover:text-white hover:underline underline-offset-4 decoration-neutral-950 dark:decoration-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Cara Kerja
          </button>
          <button
            type="button"
            onClick={onOpenFaq}
            className="hover:text-neutral-950 dark:hover:text-white hover:underline underline-offset-4 decoration-neutral-950 dark:decoration-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Tanya Jawab
          </button>
        </nav>

        {/* Zone 3: Single utility action (Theme Switcher) */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
            title={theme === 'dark' ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
            className="h-9 px-3 border border-neutral-900 dark:border-neutral-700 bg-white dark:bg-[#161616] text-neutral-900 dark:text-neutral-100 hover:bg-neutral-900 hover:text-white dark:hover:bg-neutral-100 dark:hover:text-neutral-950 text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-3.5 h-3.5" />
                <span>Terang</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5" />
                <span>Gelap</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
