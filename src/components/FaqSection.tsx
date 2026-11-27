import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface FaqItem {
  q: string;
  a: string;
}

export const FaqSection: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs: FaqItem[] = [
    {
      q: 'Mengapa jumlah total halaman booklet wajib kelipatan 4?',
      a: 'Satu lembar kertas fisik A4 memiliki 2 sisi (depan dan belakang). Karena setiap sisi memuat 2 halaman buku A5 secara berdampingan (2-up), maka 1 lembar A4 selalu menghasilkan 4 halaman buku. Jika dokumen asli Anda memiliki 10 halaman, sistem otomatis menambahkan 2 halaman kosong sehingga totalnya menjadi 12 halaman (3 lembar kertas A4 fisik).',
    },
    {
      q: 'Apa bedanya "Flip on short edge" dengan "Flip on long edge"?',
      a: 'Karena lembaran dicetak dalam orientasi Lanskap (horizontal), sumbu lipatan tengah buku sejajar dengan tepi pendek kertas (sisi kiri dan kanan). Dengan memilih "Flip on short edge" (Balik pada tepi pendek), halaman di sisi belakang akan tercetak tegak searah dengan halaman depan. Jika memilih "Flip on long edge", halaman belakang akan tercetak terbalik 180 derajat.',
    },
    {
      q: 'Printer saya tidak punya fitur bolak-balik otomatis. Bagaimana cara mencetaknya?',
      a: 'Gunakan "Opsi Printer Manual Duplex" pada panel unduh. Unduh dan cetak berkas "Sisi Depan (Halaman ganjil)" terlebih dahulu. Setelah selesai, masukkan kembali tumpukan kertas ke baki printer, lalu cetak berkas "Sisi Belakang (Halaman genap)".',
    },
    {
      q: 'Apakah dokumen PDF saya diunggah ke server eksternal?',
      a: 'Tidak. Seluruh proses pembacaan berkas, perhitungan tata letak imposisi, perenderan pratinjau, hingga pembuatan PDF A4 berlangsung sepenuhnya di memori peramban perangkat Anda secara lokal tanpa mengirim data ke server.',
    },
    {
      q: 'Berapa ketebalan maksimal buku yang disarankan untuk jilid kawat lipat tengah?',
      a: 'Untuk kertas HVS 70 atau 80 GSM, jilid saddle-stitch (lipat tengah) ideal untuk dokumen hingga 48–64 halaman (12–16 lembar A4 fisik). Di atas 64 halaman, punggung lipatan akan menebal dan lebih cocok dijilid lem panas atau spiral.',
    },
  ];

  return (
    <section className="bg-white dark:bg-[#161616] border border-neutral-900 dark:border-neutral-700 transition-colors">
      <div className="p-6 sm:p-8 border-b border-neutral-900 dark:border-neutral-700 bg-[#FAFAF8] dark:bg-[#121212]">
        <div className="font-mono text-xs font-semibold text-[#D9381E] dark:text-[#F04A2E] mb-1.5">
          Referensi Teknis
        </div>
        <h2 className="font-display text-2xl font-bold text-neutral-950 dark:text-white tracking-tight">
          Pertanyaan Seputar Cetak Booklet PDF
        </h2>
        <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 mt-1">
          Jawaban singkat untuk pengaturan printer, pelipatan kertas, dan privasi dokumen.
        </p>
      </div>

      {/* Flush divided accordion — zero nested rounded cards */}
      <div className="divide-y divide-neutral-300 dark:divide-neutral-800">
        {faqs.map((faq, index) => {
          const isOpen = openIndex === index;
          return (
            <div key={index}>
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : index)}
                className="w-full px-6 sm:px-8 py-4 text-left font-semibold text-sm text-neutral-950 dark:text-white hover:bg-[#FAFAF8] dark:hover:bg-[#1B1B1B] flex items-center justify-between gap-4 transition-colors cursor-pointer"
              >
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-xs text-neutral-400 dark:text-neutral-500 tabular-nums shrink-0">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span>{faq.q}</span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-neutral-500 shrink-0 transition-transform ${
                    isOpen ? 'rotate-180 text-[#D9381E] dark:text-[#F04A2E]' : ''
                  }`}
                />
              </button>
              {isOpen && (
                <div className="px-6 sm:px-8 pb-5 pt-1 pl-12 sm:pl-14 text-xs sm:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed max-w-4xl">
                  {faq.a}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
