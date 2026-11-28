#!/usr/bin/env node
/**
 * Generates crisp boxy Swiss prepress RGBA PNG & multi-size Windows ICO icons
 * for BukuCepat (src-tauri/icons/) without external native dependencies.
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ICON_DIR = path.resolve(__dirname, '..', 'src-tauri', 'icons');

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodeRgbaPng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const compressed = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function drawBukuCepatIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const setPx = (x, y, r, g, b, a = 255) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const idx = (y * size + x) * 4;
    rgba[idx] = r;
    rgba[idx + 1] = g;
    rgba[idx + 2] = b;
    rgba[idx + 3] = a;
  };
  const fillRect = (x0, y0, w, h, r, g, b, a = 255) => {
    const startX = Math.max(0, Math.floor(x0));
    const startY = Math.max(0, Math.floor(y0));
    const endX = Math.min(size, Math.ceil(x0 + w));
    const endY = Math.min(size, Math.ceil(y0 + h));
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        setPx(x, y, r, g, b, a);
      }
    }
  };

  // Deep ink background (#111111)
  fillRect(0, 0, size, size, 17, 17, 17, 255);

  // Outer crisp border (#262626)
  const bdr = Math.max(1, Math.round(size * 0.04));
  fillRect(0, 0, size, bdr, 38, 38, 38);
  fillRect(0, size - bdr, size, bdr, 38, 38, 38);
  fillRect(0, 0, bdr, size, 38, 38, 38);
  fillRect(size - bdr, 0, bdr, size, 38, 38, 38);

  // Open A4 booklet spread (warm paper #F5F5F3)
  const padX = Math.round(size * 0.14);
  const padY = Math.round(size * 0.22);
  const spreadW = size - padX * 2;
  const spreadH = size - padY * 2;
  fillRect(padX, padY, spreadW, spreadH, 245, 245, 243, 255);

  // Center fold line in Swiss vermilion (#D9381E)
  const spineW = Math.max(2, Math.round(size * 0.06));
  const spineX = Math.floor((size - spineW) / 2);
  fillRect(spineX, padY, spineW, spreadH, 217, 56, 30, 255);

  // Left page editorial bars (ink #171717)
  const innerPad = Math.max(2, Math.round(size * 0.07));
  const leftW = spineX - padX - innerPad * 2;
  const barH = Math.max(2, Math.round(size * 0.055));
  if (leftW > 2) {
    fillRect(padX + innerPad, padY + innerPad, leftW, barH, 23, 23, 23);
    fillRect(padX + innerPad, padY + innerPad + barH * 2, Math.round(leftW * 0.78), barH, 115, 115, 115);
    fillRect(padX + innerPad, padY + innerPad + barH * 4, Math.round(leftW * 0.9), barH, 115, 115, 115);
  }

  // Right page Swiss red accent block (#D9381E) + lines
  const rightX = spineX + spineW + innerPad;
  const rightW = padX + spreadW - innerPad - rightX;
  if (rightW > 2) {
    fillRect(rightX, padY + innerPad, rightW, Math.round(barH * 2.2), 217, 56, 30);
    fillRect(rightX, padY + innerPad + Math.round(barH * 3.4), Math.round(rightW * 0.85), barH, 23, 23, 23);
    fillRect(rightX, padY + innerPad + Math.round(barH * 5.2), Math.round(rightW * 0.65), barH, 115, 115, 115);
  }

  return encodeRgbaPng(size, size, rgba);
}

function encodeIco(pngEntries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // ICO type
  header.writeUInt16LE(pngEntries.length, 4);

  const dirEntries = [];
  let offset = 6 + pngEntries.length * 16;

  for (const { size, png } of pngEntries) {
    const entry = Buffer.alloc(16);
    entry[0] = size >= 256 ? 0 : size;
    entry[1] = size >= 256 ? 0 : size;
    entry[2] = 0; // palette
    entry[3] = 0; // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    dirEntries.push(entry);
    offset += png.length;
  }

  return Buffer.concat([header, ...dirEntries, ...pngEntries.map((e) => e.png)]);
}

fs.mkdirSync(ICON_DIR, { recursive: true });

const png16 = drawBukuCepatIcon(16);
const png32 = drawBukuCepatIcon(32);
const png48 = drawBukuCepatIcon(48);
const png128 = drawBukuCepatIcon(128);
const png256 = drawBukuCepatIcon(256);

fs.writeFileSync(path.join(ICON_DIR, '32x32.png'), png32);
fs.writeFileSync(path.join(ICON_DIR, '128x128.png'), png128);
fs.writeFileSync(path.join(ICON_DIR, '128x128@2x.png'), png256);
fs.writeFileSync(path.join(ICON_DIR, 'icon.png'), png256);
fs.writeFileSync(
  path.join(ICON_DIR, 'icon.ico'),
  encodeIco([
    { size: 16, png: png16 },
    { size: 32, png: png32 },
    { size: 48, png: png48 },
    { size: 256, png: png256 },
  ])
);

console.log('Ikon BukuCepat berhasil dibuat di src-tauri/icons/.');
