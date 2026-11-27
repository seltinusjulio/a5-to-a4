import { describe, it, expect } from 'vitest';
import { parsePdfError } from '../errorParser';

describe('parsePdfError', () => {
  const filename = 'buku_panduan.pdf';

  it('identifies password-protected PDF errors correctly', () => {
    const error1 = new Error('Password required to open this document');
    const result1 = parsePdfError(error1, filename);
    expect(result1.type).toBe('password');
    expect(result1.title).toBe('PDF Dilindungi Kata Sandi');
    expect(result1.isRecoverable).toBe(false);

    const error2 = { name: 'PasswordException', message: 'Encrypted document' };
    const result2 = parsePdfError(error2, filename);
    expect(result2.type).toBe('password');
  });

  it('identifies corrupt or invalid PDF structure errors', () => {
    const error = new Error('Invalid PDF structure: stream end not found');
    const result = parsePdfError(error, filename);
    expect(result.type).toBe('corrupt');
    expect(result.title).toBe('Struktur PDF Rusak atau Tidak Lengkap');
    expect(result.isRecoverable).toBe(true);
  });

  it('identifies empty or 0-page PDF errors', () => {
    const error = new Error('Document contains 0 pages');
    const result = parsePdfError(error, filename);
    expect(result.type).toBe('empty');
    expect(result.title).toBe('Dokumen PDF Kosong');
    expect(result.isRecoverable).toBe(false);
  });

  it('identifies missing PDF or network errors', () => {
    const error = { name: 'MissingPDFException', message: 'Missing PDF file' };
    const result = parsePdfError(error, filename);
    expect(result.type).toBe('corrupt');
    expect(result.title).toBe('Berkas Tidak Ditemukan');
  });

  it('identifies memory limit or out of memory errors', () => {
    const error = new Error('Out of memory while allocating buffer');
    const result = parsePdfError(error, filename);
    expect(result.type).toBe('unsupported');
    expect(result.title).toBe('Memori Peramban Tidak Mencukupi');
    expect(result.isRecoverable).toBe(true);
  });

  it('provides a general fallback error for unrecognized errors', () => {
    const error = new Error('Unknown internal renderer failure');
    const result = parsePdfError(error, filename);
    expect(result.type).toBe('general');
    expect(result.title).toBe('Gagal Memproses Dokumen');
    expect(result.message).toContain(filename);
    expect(result.isRecoverable).toBe(true);
  });

  it('handles non-Error objects safely', () => {
    const result = parsePdfError('String error message', filename);
    expect(result.type).toBe('general');
    expect(result.title).toBe('Gagal Memproses Dokumen');
  });
});
