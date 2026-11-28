# Changelog

Semua perubahan penting pada **Katern** dicatat dalam berkas ini.

Format mengikuti [Keep a Changelog](https://keepachangelog.com/id/1.1.0/) dan penomoran versi mengikuti [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Ditambahkan
- Add Tauri support for native file management (`fef4bb0` — 2026-11-28)
- Add GitHub Pages deployment workflow (`a0018dd` — 2026-11-27)
- Initialize BukuCepat PDF conversion app (`8369c5e` — 2026-11-27)
- Rilis portabel Windows (`.exe` & `.zip` tanpa installer) berbasis Tauri v2 yang dibangun otomatis lewat GitHub Actions.
- Mode offline murni: font UI (*Archivo*, *Plus Jakarta Sans*, *JetBrains Mono*) serta CMap & standard fonts PDF.js kini dibundel langsung di dalam aplikasi tanpa panggilan CDN eksternal.
- Dialog simpan berkas bawaan Windows (*Save As*) otomatis saat mengekspor PDF atau arsip ZIP pada aplikasi desktop portabel.
- Otomatisasi *auto-version*, *auto-tag*, pembaruan `CHANGELOG.md`, dan publikasi **GitHub Releases** pada setiap pembaruan kode di branch `main`.

### Diubah
- Perubahan nama aplikasi dari *BukuCepat* menjadi **Katern**.
- Initial commit (`1f508a6` — 2026-11-27)

### Pemeliharaan
- **ci:** Implement automated CHANGELOG generation (`2b43a62` — 2026-11-28)
- Improve base path normalization and cleanup (`a264daf` — 2026-11-28)

## [1.0.0] - 2026-11-28

### Ditambahkan
- Konverter PDF A5 Potret ke Booklet A4 Lanskap (2-Up *saddle-stitch bookfold imposition*) 100% di sisi klien.
- Antarmuka *Swiss Editorial Prepress* bergaya kotak tegas dengan dukungan mode terang dan gelap.
- Pratinjau lembar cetak A4 dengan 3 mode: **Tampilan Lembar**, **Berdampingan (Side-by-Side)** dengan kontrol zoom 50%–250%, dan **Pratinjau 3D** (*Flipbook 3D* ringkas serta *Studio 3D Lengkap* WebGL dengan simulasi lipatan A4→A5, staples tengah, dan mode lembar terpisah).
- Pemrosesan batch multi-berkas PDF, deteksi potong margin putih otomatis (*Auto-Crop*), penyesuaian margin/gutter/creep, opsi cetak duplex manual (sisi depan/belakang terpisah), dan ekspor massal ke arsip ZIP.
- Jaring pengaman stabilitas: *Error Boundary* berlapis, linting otomatis Biome + TypeScript, serta rangkaian pengujian otomatis Vitest.
- Workflow GitHub Actions untuk deploy otomatis versi web ke GitHub Pages.
