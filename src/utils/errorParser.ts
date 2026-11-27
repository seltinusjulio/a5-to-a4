/**
 * Parser kesalahan PDF untuk menghasilkan pesan ramah dalam Bahasa Indonesia.
 */

export interface ParsedPdfError {
  title: string;
  message: string;
  isRecoverable: boolean;
  type: 'password' | 'corrupt' | 'unsupported' | 'empty' | 'size' | 'general';
}

export function parsePdfError(error: unknown, filename: string): ParsedPdfError {
  const isObj = error !== null && typeof error === 'object';
  const errName = isObj && 'name' in error ? String((error as { name: unknown }).name) : (error instanceof Error ? error.name : '');
  const errStr = isObj && 'message' in error ? String((error as { message: unknown }).message) : (error instanceof Error ? error.message : String(error));

  // 1. Password protected PDF
  if (
    errName === 'PasswordException' ||
    /password/i.test(errStr) ||
    /encrypted/i.test(errStr) ||
    /need password/i.test(errStr)
  ) {
    return {
      title: 'PDF Dilindungi Kata Sandi',
      message: `Berkas "${filename}" memiliki proteksi kata sandi. Silakan buka kunci keamanan PDF sebelum mengonversinya menjadi booklet.`,
      isRecoverable: false,
      type: 'password',
    };
  }

  // 2. Corrupt or invalid PDF binary structure
  if (
    errName === 'InvalidPDFException' ||
    /invalid pdf/i.test(errStr) ||
    /corrupted/i.test(errStr) ||
    /bad xref/i.test(errStr) ||
    /stream end not found/i.test(errStr) ||
    /format error/i.test(errStr)
  ) {
    return {
      title: 'Struktur PDF Rusak atau Tidak Lengkap',
      message: `Berkas "${filename}" mengalami kerusakan data atau proses unduhan belum selesai. Coba unduh ulang dokumen asli Anda.`,
      isRecoverable: true,
      type: 'corrupt',
    };
  }

  // 3. Empty or zero-page PDF
  if (/no pages/i.test(errStr) || /0 pages/i.test(errStr) || /empty/i.test(errStr)) {
    return {
      title: 'Dokumen PDF Kosong',
      message: `Berkas "${filename}" tidak memiliki halaman untuk diatur menjadi booklet.`,
      isRecoverable: false,
      type: 'empty',
    };
  }

  // 4. Missing or network error
  if (errName === 'MissingPDFException' || /missing pdf/i.test(errStr)) {
    return {
      title: 'Berkas Tidak Ditemukan',
      message: `Tidak dapat mengakses berkas "${filename}". Pastikan berkas masih tersedia di penyimpanan perangkat Anda.`,
      isRecoverable: true,
      type: 'corrupt',
    };
  }

  // 5. Unsupported features or memory limits
  if (/memory/i.test(errStr) || /out of memory/i.test(errStr) || /maximum call stack/i.test(errStr)) {
    return {
      title: 'Memori Peramban Tidak Mencukupi',
      message: `Berkas "${filename}" membutuhkan alokasi memori yang melebihi kapasitas peramban. Coba tutup tab lain atau kompres berkas terlebih dahulu.`,
      isRecoverable: true,
      type: 'unsupported',
    };
  }

  // Default general error
  return {
    title: 'Gagal Memproses Dokumen',
    message: errStr && errStr.length < 150
      ? `Terjadi kendala pada berkas "${filename}": ${errStr}`
      : `Terjadi kendala saat membaca berkas "${filename}". Pastikan format berkas adalah PDF standar.`,
    isRecoverable: true,
    type: 'general',
  };
}
