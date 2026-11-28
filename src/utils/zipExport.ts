import JSZip from 'jszip';
import { BatchItem } from '../types/booklet';
import { generateBookletPdf } from './pdfGenerator';
import { saveBinaryFile } from './fileSave';

export interface ZipExportProgress {
  currentFile: string;
  currentIndex: number;
  totalFiles: number;
  percentage: number;
}

/**
 * Compiles all batch items into a single ZIP archive for one-click download or native desktop save.
 */
export async function exportBatchAsZip(
  items: BatchItem[],
  onProgress?: (progress: ZipExportProgress) => void
): Promise<boolean> {
  const zip = new JSZip();

  // Create a folder inside zip
  const folder = zip.folder('Booklet_A4_Siap_Cetak') || zip;

  const validItems = items.filter((item) => item.loadedDoc && item.imposition);
  if (validItems.length === 0) {
    throw new Error('Tidak ada berkas yang siap untuk diunduh.');
  }

  for (let i = 0; i < validItems.length; i++) {
    const item = validItems[i];
    if (onProgress) {
      onProgress({
        currentFile: item.filename,
        currentIndex: i + 1,
        totalFiles: validItems.length,
        percentage: Math.round(((i) / validItems.length) * 100),
      });
    }

    let pdfBytes = item.generatedPdfBytes;
    if (!pdfBytes) {
      pdfBytes = await generateBookletPdf(
        item.loadedDoc.arrayBuffer,
        item.imposition!,
        {
          mode: 'all',
          pdfjsDoc: item.loadedDoc?.pdfDocument,
          onProgress: (status) => {
            if (onProgress) {
              onProgress({
                currentFile: `${item.filename}: ${status}`,
                currentIndex: i + 1,
                totalFiles: validItems.length,
                percentage: Math.round(((i + 0.5) / validItems.length) * 100),
              });
            }
          },
        }
      );
      item.generatedPdfBytes = pdfBytes;
    }

    const cleanBaseName = item.filename.replace(/\.pdf$/i, '');
    const entryName = `Booklet_${cleanBaseName}_A4-Lanskap.pdf`;

    folder.file(entryName, pdfBytes);
  }

  // Include comprehensive Indonesian print instructions text file inside zip
  const readmeText = `=====================================================
PANDUAN MENCETAK BOOKLET PDF A4 LANSKAP (BUKUCEPAT)
=====================================================

Terima kasih telah menggunakan BukuCepat (Konverter Booklet PDF).
Seluruh berkas PDF dalam arsip ZIP ini telah diimposisi menjadi
tata letak 2-Up A4 Lanskap yang siap dicetak bolak-balik.

LANGKAH MENCETAK PADA PRINTER:
1. Buka berkas PDF Booklet di Adobe Reader, Google Chrome, atau pembaca PDF.
2. Ukuran Kertas: Pilih "A4" (210 x 297 mm).
3. Orientasi: Pilih "Lanskap" (Landscape / Melintang).
4. Skala Halaman: Pilih "100%" atau "Sesuaikan Ukuran Kertas (Fit)".
5. Cetak Dua Sisi (Duplex / Double-Sided):
   --> WAJIB PILIH: "Flip on Short Edge" (Balik pada tepi pendek)
   --> JANGAN PILIH: "Flip on Long Edge" (tepi panjang akan membuat halaman belakang terbalik!)

LANGKAH PENJILIDAN (FINISHING):
1. Susun lembar kertas berurutan: Lembar 1 di bagian paling bawah/luar.
2. Lipat tumpukan kertas tepat di garis tengah vertikal (sumbu simetri).
3. Jilid menggunakan 2 kawat staples tepat di garis lipatan tengah (saddle-stitch).
4. Buku saku A5 Anda telah selesai dengan urutan halaman sempurna!
=====================================================
`;
  folder.file('PETUNJUK_MENCETAK_BOOKLET.txt', readmeText);

  if (onProgress) {
    onProgress({
      currentFile: 'Mengompresi berkas ZIP...',
      currentIndex: validItems.length,
      totalFiles: validItems.length,
      percentage: 95,
    });
  }

  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const { saved } = await saveBinaryFile({
    data: zipBlob,
    defaultFilename: `Batch_Booklet_A4_${new Date().toISOString().slice(0, 10)}.zip`,
    mimeType: 'application/zip',
    filterName: 'Arsip ZIP',
    filterExtensions: ['zip'],
    revokeDelayMs: 10000,
  });

  return saved;
}
