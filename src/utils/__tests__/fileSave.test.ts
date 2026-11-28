import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isTauriDesktop, saveBinaryFile } from '../fileSave';

const saveMock = vi.fn();
const writeFileMock = vi.fn();

vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: (...args: unknown[]) => saveMock(...args),
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeFile: (...args: unknown[]) => writeFileMock(...args),
}));

describe('fileSave utility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
    global.URL.createObjectURL = vi.fn().mockReturnValue('blob:http://localhost/file-save-test');
    global.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
  });

  it('detects browser environment by default and triggers anchor download', async () => {
    expect(isTauriDesktop()).toBe(false);

    const clickSpy = vi.fn();
    const originalCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = originalCreate(tag);
      if (tag.toLowerCase() === 'a') {
        el.click = clickSpy;
      }
      return el;
    });

    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

    const result = await saveBinaryFile({
      data: new Uint8Array([37, 80, 68, 70]),
      defaultFilename: 'Booklet_Test.pdf',
      mimeType: 'application/pdf',
      revokeDelayMs: 5000,
    });

    expect(result).toEqual({ saved: true });
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(global.URL.createObjectURL).toHaveBeenCalledTimes(1);

    const cleanupCall = setTimeoutSpy.mock.calls.find((call) => call[1] === 5000);
    expect(cleanupCall).toBeDefined();
    (cleanupCall![0] as () => void)();
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:http://localhost/file-save-test');
  });

  it('uses native Tauri dialog and filesystem plugins when running inside Tauri desktop', async () => {
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    expect(isTauriDesktop()).toBe(true);

    saveMock.mockResolvedValue('C:\\Users\\Demo\\Booklet_Test.pdf');
    writeFileMock.mockResolvedValue(undefined);

    const payload = new Uint8Array([1, 2, 3, 4]);
    const result = await saveBinaryFile({
      data: payload,
      defaultFilename: 'Booklet_Test.pdf',
      mimeType: 'application/pdf',
      filterName: 'Dokumen PDF',
      filterExtensions: ['pdf'],
    });

    expect(saveMock).toHaveBeenCalledWith({
      defaultPath: 'Booklet_Test.pdf',
      filters: [{ name: 'Dokumen PDF', extensions: ['pdf'] }],
    });
    expect(writeFileMock).toHaveBeenCalledWith('C:\\Users\\Demo\\Booklet_Test.pdf', payload);
    expect(result).toEqual({ saved: true, path: 'C:\\Users\\Demo\\Booklet_Test.pdf' });
  });

  it('returns saved: false when user cancels native Tauri Save As dialog', async () => {
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    saveMock.mockResolvedValue(null);

    const blob = new Blob([new Uint8Array([10, 20])], { type: 'application/zip' });
    const result = await saveBinaryFile({
      data: blob,
      defaultFilename: 'Batch.zip',
      mimeType: 'application/zip',
    });

    expect(result).toEqual({ saved: false });
    expect(writeFileMock).not.toHaveBeenCalled();
  });

  it('converts Blob payloads to Uint8Array before writing via Tauri filesystem', async () => {
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    saveMock.mockResolvedValue('D:\\Output\\Batch.zip');
    writeFileMock.mockResolvedValue(undefined);

    const blob = new Blob([new Uint8Array([80, 75, 3, 4])], { type: 'application/zip' });
    const result = await saveBinaryFile({
      data: blob,
      defaultFilename: 'Batch.zip',
      mimeType: 'application/zip',
      filterName: 'Arsip ZIP',
      filterExtensions: ['zip'],
    });

    expect(result).toEqual({ saved: true, path: 'D:\\Output\\Batch.zip' });
    expect(writeFileMock).toHaveBeenCalledTimes(1);
    const writtenBytes = writeFileMock.mock.calls[0][1];
    expect(writtenBytes).toBeInstanceOf(Uint8Array);
    expect(Array.from(writtenBytes)).toEqual([80, 75, 3, 4]);
  });
});
