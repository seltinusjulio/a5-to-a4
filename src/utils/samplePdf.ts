import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

// A5 Portrait points: 148 mm x 210 mm -> 420.95 x 595.28
const A5_W = 420.95;
const A5_H = 595.28;

/**
 * Generates an 8-page realistic sample A5 portrait PDF document.
 */
export async function createSampleA5Pdf(): Promise<ArrayBuffer> {
  const doc = await PDFDocument.create();

  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontOblique = await doc.embedFont(StandardFonts.HelveticaOblique);

  // Colors
  const primaryNavy = rgb(0.09, 0.15, 0.28);
  const accentIndigo = rgb(0.24, 0.35, 0.75);
  const textDark = rgb(0.18, 0.2, 0.25);
  const textMuted = rgb(0.45, 0.48, 0.53);
  const bgSoft = rgb(0.96, 0.97, 0.99);

  // Helper to add clean running header & footer to interior pages
  const addHeaderFooter = (page: ReturnType<typeof doc.addPage>, pageNum: number) => {
    // Top rule
    page.drawLine({
      start: { x: 36, y: A5_H - 36 },
      end: { x: A5_W - 36, y: A5_H - 36 },
      thickness: 0.5,
      color: rgb(0.85, 0.87, 0.9),
    });

    page.drawText('Panduan Penjilidan & Cetak Booklet A5', {
      x: 36,
      y: A5_H - 30,
      size: 8,
      font: fontOblique,
      color: textMuted,
    });

    // Bottom rule
    page.drawLine({
      start: { x: 36, y: 36 },
      end: { x: A5_W - 36, y: 36 },
      thickness: 0.5,
      color: rgb(0.85, 0.87, 0.9),
    });

    // Page number
    page.drawText(`${pageNum}`, {
      x: A5_W / 2 - 4,
      y: 24,
      size: 9,
      font: fontBold,
      color: textDark,
    });
  };

  // --- HALAMAN 1: SAMPUL DEPAN (Front Cover) ---
  const p1 = doc.addPage([A5_W, A5_H]);
  // Cover background decoration
  p1.drawRectangle({
    x: 0,
    y: 0,
    width: A5_W,
    height: A5_H,
    color: bgSoft,
  });
  p1.drawRectangle({
    x: 0,
    y: A5_H - 180,
    width: A5_W,
    height: 180,
    color: primaryNavy,
  });
  p1.drawRectangle({
    x: 36,
    y: A5_H - 190,
    width: 60,
    height: 4,
    color: accentIndigo,
  });

  p1.drawText('BUKU PANDUAN PRAKTIS', {
    x: 36,
    y: A5_H - 70,
    size: 11,
    font: fontBold,
    color: rgb(0.65, 0.75, 0.95),
  });

  p1.drawText('Mencetak Booklet A5', {
    x: 36,
    y: A5_H - 110,
    size: 26,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  p1.drawText('Dari Lembaran Kertas A4 Lanskap', {
    x: 36,
    y: A5_H - 138,
    size: 14,
    font: fontRegular,
    color: rgb(0.85, 0.9, 0.98),
  });

  // Cover body note
  p1.drawText('Dibuat dengan Aplikasi Katern', {
    x: 36,
    y: 280,
    size: 12,
    font: fontBold,
    color: textDark,
  });

  const p1Desc = [
    'Dokumen ini adalah contoh berkas PDF ukuran standar A5 Potret (148 x 210 mm).',
    'Gunakan berkas ini untuk menguji bagaimana 8 halaman dokumen diatur ulang',
    'secara presisi menjadi 2 lembar kertas A4 fisik siap cetak.',
  ];
  let curY = 250;
  for (const line of p1Desc) {
    p1.drawText(line, { x: 36, y: curY, size: 9.5, font: fontRegular, color: textDark });
    curY -= 16;
  }

  // Cover footer badge
  p1.drawRectangle({
    x: 36,
    y: 40,
    width: A5_W - 72,
    height: 38,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.85, 0.88, 0.92),
    borderWidth: 1,
  });
  p1.drawText('100% Client-Side Imposition Engine', {
    x: 48,
    y: 56,
    size: 9,
    font: fontBold,
    color: accentIndigo,
  });
  p1.drawText('Edisi Sampel Uji Coba - Standar A5 (8 Halaman)', {
    x: 48,
    y: 46,
    size: 8,
    font: fontRegular,
    color: textMuted,
  });

  // --- HALAMAN 2: PRAKATA & HAK CIPTA ---
  const p2 = doc.addPage([A5_W, A5_H]);
  addHeaderFooter(p2, 2);

  p2.drawText('Prakata & Catatan Redaksi', {
    x: 36,
    y: A5_H - 70,
    size: 16,
    font: fontBold,
    color: primaryNavy,
  });

  const p2Lines = [
    'Selamat datang di dokumen uji coba konversi booklet Katern.',
    '',
    'Ketika mencetak buku saku atau modul belajar, kita sering mengalami',
    'kesulitan saat menyusun halaman secara manual. Memasangkan halaman',
    'luar dan dalam (imposisi) membutuhkan perhitungan matematis yang rumit.',
    '',
    'Dengan teknik Bookfold Imposition 2-up:',
    '- Total halaman selalu disesuaikan menjadi kelipatan 4.',
    '- Halaman terluar (halaman terakhir) dipasangkan dengan halaman 1.',
    '- Saat dicetak bolak-balik lalu dilipat dua di tengah, urutan buku',
    '  akan langsung berurutan dari halaman pertama hingga terakhir!',
    '',
    'Dokumen ini bebas digunakan untuk pengujian printer dan pratinjau lembar.',
  ];
  curY = A5_H - 100;
  for (const line of p2Lines) {
    if (line === '') {
      curY -= 10;
      continue;
    }
    p2.drawText(line, { x: 36, y: curY, size: 9.5, font: fontRegular, color: textDark });
    curY -= 15;
  }

  // --- HALAMAN 3: BAB 1 ---
  const p3 = doc.addPage([A5_W, A5_H]);
  addHeaderFooter(p3, 3);

  p3.drawText('Bab 1: Konsep Imposisi Booklet', {
    x: 36,
    y: A5_H - 70,
    size: 16,
    font: fontBold,
    color: primaryNavy,
  });

  const p3Lines = [
    'Mengapa kita membutuhkan lembar A4 lanskap untuk buku A5?',
    '',
    'Satu lembar kertas A4 berukuran 297 x 210 mm. Jika kertas tersebut',
    'diposisikan melintang (lanskap) dan dibagi dua tepat di tengahnya, kita',
    'mendapatkan dua bidang berukuran masing-masing 148.5 x 210 mm.',
    '',
    'Ukuran tersebut persis sama dengan ukuran standar internasional A5!',
    '',
    'Prinsip Pelipatan (Saddle-Stitch):',
    'Kumpulan lembar A4 ditumpuk satu di atas yang lain, lalu dilipat tepat di garis',
    'tengahnya. Karena setiap lembar fisik memiliki 2 sisi (depan dan belakang),',
    'dan setiap sisi memuat 2 halaman A5, maka 1 lembar A4 memuat tepat',
    '4 halaman buku A5.',
  ];
  curY = A5_H - 100;
  for (const line of p3Lines) {
    if (line === '') {
      curY -= 10;
      continue;
    }
    p3.drawText(line, { x: 36, y: curY, size: 9.5, font: fontRegular, color: textDark });
    curY -= 15;
  }

  // --- HALAMAN 4: BAB 1 LANJUTAN ---
  const p4 = doc.addPage([A5_W, A5_H]);
  addHeaderFooter(p4, 4);

  p4.drawText('Bab 1 (Lanjutan): Urutan Pasangan Halaman', {
    x: 36,
    y: A5_H - 70,
    size: 15,
    font: fontBold,
    color: primaryNavy,
  });

  const p4Lines = [
    'Untuk dokumen 8 halaman ini, pembagian fisiknya adalah sebagai berikut:',
    '',
    'Lembar 1 (Kertas Fisik Terluar):',
    '- Sisi Depan : [ Halaman 8 | Halaman 1 ] (Sampul)',
    '- Sisi Belakang: [ Halaman 2 | Halaman 7 ]',
    '',
    'Lembar 2 (Kertas Fisik Terdalam / Inti):',
    '- Sisi Depan : [ Halaman 6 | Halaman 3 ]',
    '- Sisi Belakang: [ Halaman 4 | Halaman 5 ] (Lipatan Tengah)',
    '',
    'Ketika Lembar 2 dimasukkan ke dalam Lembar 1 dan dilipat di tengah:',
    '- Sampul buku adalah Halaman 1',
    '- Buka sampul: Halaman 2 menghadap Halaman 3',
    '- Buka lagi: Halaman 4 menghadap Halaman 5',
    '- Buka lagi: Halaman 6 menghadap Halaman 7',
    '- Tutup buku: Sampul belakang adalah Halaman 8',
  ];
  curY = A5_H - 100;
  for (const line of p4Lines) {
    if (line === '') {
      curY -= 10;
      continue;
    }
    p4.drawText(line, { x: 36, y: curY, size: 9.5, font: fontRegular, color: textDark });
    curY -= 15;
  }

  // --- HALAMAN 5: BAB 2 ---
  const p5 = doc.addPage([A5_W, A5_H]);
  addHeaderFooter(p5, 5);

  p5.drawText('Bab 2: Kunci Cetak Bolak-Balik (Duplex)', {
    x: 36,
    y: A5_H - 70,
    size: 16,
    font: fontBold,
    color: primaryNavy,
  });

  const p5Lines = [
    'PENTING: Pengaturan Printer yang Wajib Diperhatikan!',
    '',
    'Saat mencetak dokumen booklet hasil konversi:',
    '1. Pastikan ukuran kertas di dialog printer diatur ke A4.',
    '2. Pastikan orientasi kertas dipilih Lanskap (Landscape).',
    '3. Aktifkan pencetakan dua sisi (Double-sided / Duplex printing).',
    '4. Paling Krusial: Pilih opsi "Flip on Short Edge" (Balik pada tepi pendek),',
    '   BUKAN "Flip on Long Edge" (tepi panjang).',
    '',
    'Mengapa tepi pendek?',
    'Karena orientasi lembar A4 adalah lanskap. Tepi pendek berada di sebelah',
    'kiri dan kanan kertas, sejajar dengan arah lipatan vertikal di tengah.',
    'Jika salah memilih "tepi panjang", sisi belakang akan tercetak terbalik (jungkir balik).',
  ];
  curY = A5_H - 100;
  for (const line of p5Lines) {
    if (line === '') {
      curY -= 10;
      continue;
    }
    p5.drawText(line, { x: 36, y: curY, size: 9.5, font: fontRegular, color: textDark });
    curY -= 15;
  }

  // --- HALAMAN 6: FINISHING & JILID ---
  const p6 = doc.addPage([A5_W, A5_H]);
  addHeaderFooter(p6, 6);

  p6.drawText('Bab 2 (Lanjutan): Melipat & Menstaples', {
    x: 36,
    y: A5_H - 70,
    size: 15,
    font: fontBold,
    color: primaryNavy,
  });

  const p6Lines = [
    'Setelah seluruh lembar tercetak dengan rapi:',
    '',
    'Langkah 1: Urutkan Kertas',
    'Susun lembaran kertas berurutan: Lembar 1 di bagian bawah/luar, disusul',
    'Lembar 2 di atasnya. Rapikan tepi kertas agar rata sempurna.',
    '',
    'Langkah 2: Melipat Kertas',
    'Lipat tumpukan kertas tepat pada garis tengah panduan lipat. Tekan lipatan',
    'dengan penggaris atau ujung kuku agar terbentuk punggung buku yang tajam.',
    '',
    'Langkah 3: Menjilid (Staples Tengah)',
    'Gunakan stapler jilid panjang (long-reach stapler) atau buka stapler biasa di atas',
    'alas penghapus/gabus, lalu tancapkan 2 buah staples di garis lipatan.',
    'Tekuk kedua kaki staples ke arah dalam secara manual.',
  ];
  curY = A5_H - 100;
  for (const line of p6Lines) {
    if (line === '') {
      curY -= 10;
      continue;
    }
    p6.drawText(line, { x: 36, y: curY, size: 9.5, font: fontRegular, color: textDark });
    curY -= 15;
  }

  // --- HALAMAN 7: TIPS & SPESIFIKASI KERTAS ---
  const p7 = doc.addPage([A5_W, A5_H]);
  addHeaderFooter(p7, 7);

  p7.drawText('Tips Tambahan & Pemilihan Kertas', {
    x: 36,
    y: A5_H - 70,
    size: 16,
    font: fontBold,
    color: primaryNavy,
  });

  const p7Lines = [
    'Rekomendasi Bahan Cetak untuk Hasil Maksimal:',
    '',
    '1. Kertas HVS 70 - 80 GSM:',
    '   Sangat cocok untuk buku saku, materi pelatihan, doa, atau novel pendek.',
    '   Ketebalan ideal hingga 40 halaman (10 lembar A4).',
    '',
    '2. Kertas Book Paper 72 GSM:',
    '   Warna krem hangat, nyaman dibaca tanpa silau lampu, dan memberikan kesan',
    '   buku penerbit profesional.',
    '',
    '3. Sampul Depan Lebih Tebal (Opsional):',
    '   Anda dapat mencetak Lembar 1 pada kertas Concorde atau Art Paper 150 GSM',
    '   untuk memberikan cover bertekstur elegan pada booklet Anda.',
    '',
    'Aplikasi Katern berjalan sepenuhnya di peramban Anda secara instan dan aman.',
  ];
  curY = A5_H - 100;
  for (const line of p7Lines) {
    if (line === '') {
      curY -= 10;
      continue;
    }
    p7.drawText(line, { x: 36, y: curY, size: 9.5, font: fontRegular, color: textDark });
    curY -= 15;
  }

  // --- HALAMAN 8: SAMPUL BELAKANG (Back Cover) ---
  const p8 = doc.addPage([A5_W, A5_H]);
  p8.drawRectangle({
    x: 0,
    y: 0,
    width: A5_W,
    height: A5_H,
    color: bgSoft,
  });
  p8.drawRectangle({
    x: 0,
    y: 0,
    width: A5_W,
    height: 90,
    color: primaryNavy,
  });

  p8.drawText('TENTANG BUKU INI', {
    x: 36,
    y: A5_H - 80,
    size: 12,
    font: fontBold,
    color: accentIndigo,
  });

  p8.drawText('Solusi Cetak Mandiri Bebas Ribet', {
    x: 36,
    y: A5_H - 105,
    size: 16,
    font: fontBold,
    color: primaryNavy,
  });

  const p8Desc = [
    'Katern mengubah dokumen naskah digital menjadi buku fisik dengan',
    'tata letak presisi tinggi tanpa perlu perangkat lunak mahal atau pengaturan printer rumit.',
    '',
    'Fitur Unggulan:',
    '- Imposisi otomatis 2-up A5 ke A4 lanskap',
    '- Penyesuaian otomatis kelipatan 4 halaman (saddle-stitch)',
    '- Pratinjau interaktif lembar per lembar',
    '- 100% Offline & Privat - Dokumen tidak dikirim ke internet',
  ];
  curY = A5_H - 145;
  for (const line of p8Desc) {
    if (line === '') {
      curY -= 8;
      continue;
    }
    p8.drawText(line, { x: 36, y: curY, size: 9.5, font: fontRegular, color: textDark });
    curY -= 16;
  }

  // Barcode / publisher box
  p8.drawRectangle({
    x: 36,
    y: 110,
    width: A5_W - 72,
    height: 70,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.85, 0.88, 0.92),
    borderWidth: 1,
  });

  // Simulated barcode stripes
  for (let bx = 50; bx < 170; bx += 4) {
    const barW = (bx % 3 === 0) ? 2 : 1;
    p8.drawLine({
      start: { x: bx, y: 165 },
      end: { x: bx, y: 125 },
      thickness: barW,
      color: textDark,
    });
  }
  p8.drawText('ISBN 978-602-0000-00-1', {
    x: 50,
    y: 116,
    size: 7.5,
    font: fontRegular,
    color: textMuted,
  });

  p8.drawText('Diterbitkan oleh:', {
    x: 200,
    y: 156,
    size: 8,
    font: fontRegular,
    color: textMuted,
  });
  p8.drawText('Katern Mandiri', {
    x: 200,
    y: 142,
    size: 10,
    font: fontBold,
    color: primaryNavy,
  });
  p8.drawText('Inisiatif Pencetakan Terbuka', {
    x: 200,
    y: 128,
    size: 8,
    font: fontRegular,
    color: textMuted,
  });

  p8.drawText('Halaman 8 - Sampul Belakang', {
    x: 36,
    y: 40,
    size: 10,
    font: fontBold,
    color: rgb(1, 1, 1),
  });
  p8.drawText('Terima kasih telah menggunakan konverter Katern.', {
    x: 36,
    y: 24,
    size: 8.5,
    font: fontRegular,
    color: rgb(0.8, 0.85, 0.95),
  });

  const pdfBytes = await doc.save();
  // Ensure typed ArrayBuffer
  const copy = new Uint8Array(pdfBytes).buffer as ArrayBuffer;
  return copy;
}
