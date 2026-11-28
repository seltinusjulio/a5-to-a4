# Changelog

Semua perubahan penting pada **BukuCepat** dicatat dalam berkas ini.

Format mengikuti [Keep a Changelog](https://keepachangelog.com/id/1.1.0/) dan penomoran versi mengikuti [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Ditambahkan
- Rilis portabel Windows (`.exe` & `.zip` tanpa installer) berbasis Tauri v2 yang dibangun otomatis lewat GitHub Actions.
- Mode offline murni: font UI (*Archivo*, *Plus Jakarta Sans*, *JetBrains Mono*) serta CMap & standard fonts PDF.js kini dibundel langsung di dalam aplikasi tanpa panggilan CDN eksternal.
- Dialog simpan berkas bawaan Windows (*Save As*) otomatis saat mengekspor PDF atau arsip ZIP pada aplikasi desktop portabel.
- Skrip rilis dan ekstraksi catatan rilis otomatis (`npm run release -- <versi>`).

## [1.0.0] - 2026-11-28

### Ditambahkan
- Konverter PDF A5 Potret ke Booklet A4 Lanskap (2-Up *saddle-stitch bookfold imposition*) 100% di sisi klien.
- Antarmuka *Swiss Editorial Prepress* bergaya kotak tegas dengan dukungan mode terang dan gelap.
- Pratinjau lembar cetak A4 dengan 3 mode: **Tampilan Lembar**, **Berdampingan (Side-by-Side)** dengan kontrol zoom 50%–250%, dan **Pratinjau 3D** (*Flipbook 3D* ringkas serta *Studio 3D Lengkap* WebGL dengan simulasi lipatan A4→A5, staples tengah, dan mode lembar terpisah).
- Pemrosesan batch multi-berkas PDF, deteksi potong margin putih otomatis (*Auto-Crop*), penyesuaian margin/gutter/creep, opsi cetak duplex manual (sisi depan/belakang terpisah), dan ekspor massal ke arsip ZIP.
- Jaring pengaman stabilitas: *Error Boundary* berlapis, linting otomatis Biome + TypeScript, serta rangkaian pengujian otomatis Vitest.
- Workflow GitHub Actions untuk deploy otomatis versi web ke GitHub Pages.
