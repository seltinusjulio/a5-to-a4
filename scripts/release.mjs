#!/usr/bin/env node
/**
 * Release & Changelog management CLI for BukuCepat.
 *
 * Usage:
 *   node scripts/release.mjs bump <version>              Sync version across package.json, tauri.conf.json, Cargo.toml & roll CHANGELOG.md [Unreleased]
 *   node scripts/release.mjs sync-version <version>      Sync version into package.json, tauri.conf.json & Cargo.toml without editing CHANGELOG.md
 *   node scripts/release.mjs extract <version> [--output <file>]  Extract release notes for a given version/tag from CHANGELOG.md
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const SEMVER_RE = /^v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/;

export function normalizeVersion(input) {
  const match = String(input || '').trim().match(SEMVER_RE);
  if (!match) {
    throw new Error(
      `Versi tidak valid: "${input}". Gunakan format Semantic Versioning, misalnya 1.1.0 atau v1.1.0.`
    );
  }
  return match[1];
}

export function syncVersionFiles(version, rootDir = ROOT) {
  const pkgPath = path.join(rootDir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.version = version;
  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');

  const tauriConfPath = path.join(rootDir, 'src-tauri', 'tauri.conf.json');
  if (fs.existsSync(tauriConfPath)) {
    const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
    tauriConf.version = version;
    fs.writeFileSync(tauriConfPath, `${JSON.stringify(tauriConf, null, 2)}\n`, 'utf8');
  }

  const cargoPath = path.join(rootDir, 'src-tauri', 'Cargo.toml');
  if (fs.existsSync(cargoPath)) {
    const cargo = fs.readFileSync(cargoPath, 'utf8');
    const updatedCargo = cargo.replace(
      /^version\s*=\s*"[^"]*"/m,
      `version = "${version}"`
    );
    fs.writeFileSync(cargoPath, updatedCargo, 'utf8');
  }
}

export function promoteUnreleasedChangelog(changelogContent, version, dateStr) {
  const cleanVer = normalizeVersion(version);
  const sectionPattern = new RegExp(`^## \\[${escapeRegExp(cleanVer)}\\]`, 'm');
  if (sectionPattern.test(changelogContent)) {
    throw new Error(`Versi [${cleanVer}] sudah ada di CHANGELOG.md.`);
  }

  const unreleasedHeaderRe = /^## \[Unreleased\][ \t]*\r?\n/m;
  const headerMatch = unreleasedHeaderRe.exec(changelogContent);
  if (!headerMatch) {
    throw new Error('Bagian "## [Unreleased]" tidak ditemukan di CHANGELOG.md.');
  }

  const afterHeaderIdx = headerMatch.index + headerMatch[0].length;
  const rest = changelogContent.slice(afterHeaderIdx);
  const nextSectionMatch = /^## \[/m.exec(rest);
  const unreleasedBody = (nextSectionMatch ? rest.slice(0, nextSectionMatch.index) : rest).trim();
  const trailing = nextSectionMatch ? rest.slice(nextSectionMatch.index) : '';

  const releaseBody =
    unreleasedBody.length > 0
      ? unreleasedBody
      : '### Diubah\n- Pemeliharaan rutin dan pembaruan rilis.';

  const before = changelogContent.slice(0, headerMatch.index);
  const normalizedTrailing = trailing ? `\n\n${trailing.replace(/^\r?\n+/, '')}` : '\n';

  return `${before}## [Unreleased]\n\n## [${cleanVer}] - ${dateStr}\n\n${releaseBody}${normalizedTrailing}`;
}

export function extractChangelogSection(changelogContent, versionOrTag) {
  const cleanVer = normalizeVersion(versionOrTag);
  const headerRe = new RegExp(`^## \\[${escapeRegExp(cleanVer)}\\][^\\n]*\\r?\\n`, 'm');
  const match = headerRe.exec(changelogContent);
  if (!match) {
    return null;
  }

  const startIdx = match.index + match[0].length;
  const rest = changelogContent.slice(startIdx);
  const nextHeader = /^## \[/m.exec(rest);
  const body = (nextHeader ? rest.slice(0, nextHeader.index) : rest).trim();
  return body.length > 0 ? body : null;
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === '--help' || command === '-h') {
    console.log(`Penggunaan:
  npm run release -- <versi>                      Naikkan versi & pindahkan [Unreleased] di CHANGELOG.md
  node scripts/release.mjs sync-version <versi>   Sinkronkan versi ke package.json, tauri.conf.json, Cargo.toml
  node scripts/release.mjs extract <versi> [--output <file>]  Ekstrak catatan rilis dari CHANGELOG.md`);
    process.exit(0);
  }

  if (command === 'bump' || SEMVER_RE.test(command)) {
    const rawVersion = command === 'bump' ? args[1] : command;
    const version = normalizeVersion(rawVersion);
    const today = new Date().toISOString().slice(0, 10);

    const changelogPath = path.join(ROOT, 'CHANGELOG.md');
    const currentChangelog = fs.readFileSync(changelogPath, 'utf8');
    const updatedChangelog = promoteUnreleasedChangelog(currentChangelog, version, today);

    syncVersionFiles(version, ROOT);
    fs.writeFileSync(changelogPath, updatedChangelog, 'utf8');

    console.log(`Versi berhasil diperbarui ke v${version} (${today}).`);
    console.log('Berkas diperbarui: package.json, src-tauri/tauri.conf.json, src-tauri/Cargo.toml, CHANGELOG.md');
    console.log('\nLangkah selanjutnya untuk memicu rilis portabel Windows di GitHub Actions:');
    console.log(`  git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml CHANGELOG.md`);
    console.log(`  git commit -m "chore(release): v${version}"`);
    console.log(`  git tag v${version}`);
    console.log(`  git push && git push origin v${version}`);
    return;
  }

  if (command === 'sync-version') {
    const version = normalizeVersion(args[1]);
    syncVersionFiles(version, ROOT);
    console.log(`Versi disinkronkan ke ${version}.`);
    return;
  }

  if (command === 'extract') {
    const version = normalizeVersion(args[1]);
    const outputFlagIdx = args.indexOf('--output');
    const outputFile = outputFlagIdx !== -1 ? args[outputFlagIdx + 1] : null;

    const changelogPath = path.join(ROOT, 'CHANGELOG.md');
    const content = fs.existsSync(changelogPath)
      ? fs.readFileSync(changelogPath, 'utf8')
      : '';

    const extracted =
      extractChangelogSection(content, version) ||
      `### Rilis BukuCepat v${version}\n- Paket portabel Windows offline (tanpa installer).`;

    const formatted = [
      `## BukuCepat v${version} — Windows Portabel (Offline)`,
      '',
      extracted,
      '',
      '---',
      '### Cara Menjalankan (Portabel, Tanpa Instalasi)',
      '1. Unduh berkas `BukuCepat-v' + version + '-windows-x64-portable.zip` (atau langsung berkas `.exe`).',
      '2. Ekstrak ke folder mana saja (termasuk flashdisk) lalu klik ganda **`BukuCepat.exe`**.',
      '3. Jika muncul peringatan Windows SmartScreen pada pemakaian pertama, pilih **More info → Run anyway**.',
      '',
    ].join('\n');

    if (outputFile) {
      fs.writeFileSync(path.resolve(ROOT, outputFile), formatted, 'utf8');
      console.log(`Catatan rilis v${version} ditulis ke ${outputFile}`);
    } else {
      process.stdout.write(formatted);
    }
    return;
  }

  throw new Error(`Perintah tidak dikenal: "${command}".`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  try {
    main();
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
