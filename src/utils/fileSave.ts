/**
 * Dual-target binary file saving utility for Katern.
 * - On Tauri desktop (Windows portable): opens the native OS "Save As" dialog
 *   and writes directly to the user-selected file path.
 * - On Web / GitHub Pages: triggers a standard browser Blob download.
 */

export interface SaveBinaryFileOptions {
  data: Uint8Array | Blob;
  defaultFilename: string;
  mimeType: string;
  filterName?: string;
  filterExtensions?: string[];
  revokeDelayMs?: number;
}

export interface SaveBinaryFileResult {
  saved: boolean;
  path?: string;
}

export function isTauriDesktop(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function saveBinaryFile(
  options: SaveBinaryFileOptions
): Promise<SaveBinaryFileResult> {
  const {
    data,
    defaultFilename,
    mimeType,
    filterName,
    filterExtensions,
    revokeDelayMs = 5000,
  } = options;

  if (isTauriDesktop()) {
    const [{ save }, { writeFile }] = await Promise.all([
      import('@tauri-apps/plugin-dialog'),
      import('@tauri-apps/plugin-fs'),
    ]);

    const filters =
      filterName && filterExtensions && filterExtensions.length > 0
        ? [{ name: filterName, extensions: filterExtensions }]
        : undefined;

    const targetPath = await save({
      defaultPath: defaultFilename,
      filters,
    });

    if (!targetPath) {
      return { saved: false };
    }

    const bytes =
      data instanceof Uint8Array
        ? data
        : new Uint8Array(await data.arrayBuffer());

    await writeFile(targetPath, bytes);
    return { saved: true, path: targetPath };
  }

  const blob =
    data instanceof Blob
      ? data
      : new Blob([data.buffer as ArrayBuffer], { type: mimeType });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = defaultFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, revokeDelayMs);

  return { saved: true };
}
