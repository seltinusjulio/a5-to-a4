#!/usr/bin/env node
/**
 * Release, Auto-Versioning & Changelog management CLI for Katern.
 *
 * Usage:
 *   node scripts/release.mjs auto [--force-bump patch|minor|major] [--notes-output <file>] [--github-output <file>]
 *       Automatically calculates the next SemVer version from git commits since the last tag,
 *       updates CHANGELOG.md, syncs package.json / tauri.conf.json / Cargo.toml, and writes release notes.
 *   node scripts/release.mjs bump <version>
 *       Manually bumps version across package.json, tauri.conf.json, Cargo.toml & rolls CHANGELOG.md [Unreleased].
 *   node scripts/release.mjs sync-version <version>
 *       Syncs version into package.json, tauri.conf.json & Cargo.toml without editing CHANGELOG.md.
 *   node scripts/release.mjs extract <version> [--output <file>]
 *       Extracts release notes for a given version/tag from CHANGELOG.md.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  mergeCommitsIntoChangelog,
  parseGitLog,
  shouldSkipCommit,
} from './generate-changelog.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const SEMVER_RE = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;

export function normalizeVersion(input) {
  const match = String(input || '').trim().match(SEMVER_RE);
  if (!match) {
    throw new Error(
      `Versi tidak valid: "${input}". Gunakan format Semantic Versioning, misalnya 1.1.0 atau v1.1.0.`
    );
  }
  const suffix = match[4] ? `-${match[4]}` : '';
  return `${match[1]}.${match[2]}.${match[3]}${suffix}`;
}

export function compareSemver(a, b) {
  const pa = normalizeVersion(a).split('-')[0].split('.').map(Number);
  const pb = normalizeVersion(b).split('-')[0].split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

export function bumpSemver(version, bumpType) {
  const clean = normalizeVersion(version);
  const [major, minor, patch] = clean.split('-')[0].split('.').map(Number);

  if (bumpType === 'major') return `${major + 1}.0.0`;
  if (bumpType === 'minor') return `${major}.${minor + 1}.0`;
  if (bumpType === 'patch') return `${major}.${minor}.${patch + 1}`;

  throw new Error(`Tipe kenaikan versi tidak valid: "${bumpType}".`);
}

export function determineBumpType(commits) {
  if (!Array.isArray(commits) || commits.length === 0) {
    return 'none';
  }

  let hasFeat = false;
  for (const commit of commits) {
    const subject = String(commit.subject || '').trim();
    const body = String(commit.body || '');

    if (shouldSkipCommit(subject)) continue;

    if (
      /^[a-zA-Z]+(?:\([^)]+\))?!:/.test(subject) ||
      /BREAKING[ -]CHANGE:/i.test(body)
    ) {
      return 'major';
    }

    if (/^feat(?:\([^)]+\))?:/i.test(subject)) {
      hasFeat = true;
    }
  }

  return hasFeat ? 'minor' : 'patch';
}

export function extractExistingChangelogVersions(changelogContent) {
  const versions = new Set();
  const re = /^## \[v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\]/gm;
  let match = re.exec(changelogContent || '');
  while (match) {
    versions.add(match[1]);
    match = re.exec(changelogContent || '');
  }
  return versions;
}

/**
 * @param {{
 *   packageVersion: string;
 *   latestTag?: string | null;
 *   existingTags?: string[];
 *   existingChangelogVersions?: Set<string>;
 *   bumpType: 'major' | 'minor' | 'patch';
 * }} params
 */
export function resolveNextVersion({
  packageVersion,
  latestTag = null,
  existingTags = [],
  existingChangelogVersions = new Set(),
  bumpType,
}) {
  let baseVersion = normalizeVersion(packageVersion || '1.0.0');

  if (latestTag && SEMVER_RE.test(latestTag)) {
    const cleanTag = normalizeVersion(latestTag);
    if (compareSemver(cleanTag, baseVersion) > 0) {
      baseVersion = cleanTag;
    }
  }

  const tagSet = new Set(
    existingTags
      .filter((t) => SEMVER_RE.test(t))
      .map((t) => normalizeVersion(t))
  );

  let candidate = bumpSemver(baseVersion, bumpType);
  while (tagSet.has(candidate) || existingChangelogVersions.has(candidate)) {
    candidate = bumpSemver(candidate, 'patch');
  }
  return candidate;
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

export function formatReleaseNotes(version, sectionBody) {
  const cleanVer = normalizeVersion(version);
  const body =
    sectionBody ||
    `### Rilis Katern v${cleanVer}\n- Paket portabel Windows offline (tanpa installer).`;

  return [
    `## Katern v${cleanVer} — Windows Portabel (Offline)`,
    '',
    body,
    '',
    '---',
    '### Cara Menjalankan (Portabel, Tanpa Instalasi)',
    `1. Unduh berkas \`Katern-v${cleanVer}-windows-x64-portable.zip\` (atau langsung berkas \`.exe\`).`,
    '2. Ekstrak ke folder mana saja (termasuk flashdisk) lalu klik ganda **`Katern.exe`**.',
    '3. Jika muncul peringatan Windows SmartScreen pada pemakaian pertama, pilih **More info → Run anyway**.',
    '',
  ].join('\n');
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function runGit(args, cwd = ROOT) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

function getCommitsWithBodySinceTag(rootDir = ROOT) {
  let latestTag = null;
  let existingTags = [];

  try {
    const rawTags = runGit(['tag', '--list', 'v*', '--sort=-v:refname'], rootDir);
    existingTags = rawTags
      .split(/\r?\n/)
      .map((t) => t.trim())
      .filter((t) => SEMVER_RE.test(t));
    if (existingTags.length > 0) {
      latestTag = existingTags[0];
    }
  } catch {
    existingTags = [];
  }

  const rangeArgs = latestTag ? [`${latestTag}..HEAD`] : ['-n', '30'];
  let raw = '';
  try {
    raw = runGit(
      ['log', ...rangeArgs, '--no-merges', '--pretty=format:%h%x1f%ad%x1f%s%x1f%b%x1e', '--date=short'],
      rootDir
    );
  } catch {
    return { latestTag, existingTags, commits: [] };
  }

  const commits = [];
  for (const record of raw.split('\x1e')) {
    if (!record.trim()) continue;
    const [hash, date, subject, ...bodyParts] = record.split('\x1f');
    const cleanSubject = (subject || '').trim();
    if (!hash || !cleanSubject || shouldSkipCommit(cleanSubject)) continue;
    commits.push({
      hash: hash.trim(),
      date: (date || '').trim(),
      subject: cleanSubject,
      body: bodyParts.join('\x1f').trim(),
    });
  }

  return { latestTag, existingTags, commits };
}

function writeGithubOutput(outputPath, entries) {
  if (!outputPath) return;
  const lines = Object.entries(entries).map(([k, v]) => `${k}=${v}`);
  fs.appendFileSync(outputPath, `${lines.join('\n')}\n`, 'utf8');
}

function getArgValue(args, flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
}

function runAutoRelease(args) {
  const forceBump = getArgValue(args, '--force-bump');
  const notesOutput = getArgValue(args, '--notes-output') || 'release-notes.md';
  const githubOutput = getArgValue(args, '--github-output') || process.env.GITHUB_OUTPUT || '';

  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const changelogPath = path.join(ROOT, 'CHANGELOG.md');
  const existingChangelog = fs.existsSync(changelogPath)
    ? fs.readFileSync(changelogPath, 'utf8')
    : '';

  const { latestTag, existingTags, commits } = getCommitsWithBodySinceTag(ROOT);
  const detectedBump = determineBumpType(commits);
  const bumpType =
    forceBump && ['major', 'minor', 'patch'].includes(forceBump)
      ? forceBump
      : detectedBump;

  if (bumpType === 'none') {
    const currentVer = normalizeVersion(pkg.version);
    console.log('Tidak ada commit perubahan baru sejak rilis terakhir — auto-release dilewati.');
    writeGithubOutput(githubOutput, {
      should_release: 'false',
      version: currentVer,
      tag: `v${currentVer}`,
      bump: 'none',
    });
    return;
  }

  const existingChangelogVersions = extractExistingChangelogVersions(existingChangelog);
  const nextVersion = resolveNextVersion({
    packageVersion: pkg.version,
    latestTag,
    existingTags,
    existingChangelogVersions,
    bumpType,
  });

  const today = new Date().toISOString().slice(0, 10);

  // 1. Merge any unrecorded commits into [Unreleased]
  const merged = mergeCommitsIntoChangelog(existingChangelog, commits);

  // 2. Promote [Unreleased] into the new release heading
  const promoted = promoteUnreleasedChangelog(merged.content, nextVersion, today);

  // 3. Persist updated CHANGELOG.md & sync version files
  fs.writeFileSync(changelogPath, promoted, 'utf8');
  syncVersionFiles(nextVersion, ROOT);

  // 4. Write formatted release notes for GitHub Releases
  const section = extractChangelogSection(promoted, nextVersion);
  const notes = formatReleaseNotes(nextVersion, section);
  fs.writeFileSync(path.resolve(ROOT, notesOutput), notes, 'utf8');

  writeGithubOutput(githubOutput, {
    should_release: 'true',
    version: nextVersion,
    tag: `v${nextVersion}`,
    bump: bumpType,
  });

  console.log(`Auto-release siap: v${nextVersion} (kenaikan: ${bumpType}, ${commits.length} commit).`);
}

function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === '--help' || command === '-h') {
    console.log(`Penggunaan:
  node scripts/release.mjs auto [--force-bump patch|minor|major]  Hitung versi otomatis, perbarui CHANGELOG.md, dan siapkan rilis
  npm run release -- <versi>                                      Naikkan versi manual & pindahkan [Unreleased] di CHANGELOG.md
  node scripts/release.mjs sync-version <versi>                   Sinkronkan versi ke package.json, tauri.conf.json, Cargo.toml
  node scripts/release.mjs extract <versi> [--output <file>]      Ekstrak catatan rilis dari CHANGELOG.md`);
    process.exit(0);
  }

  if (command === 'auto') {
    runAutoRelease(args.slice(1));
    return;
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
    console.log('  git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml CHANGELOG.md');
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
    const outputFile = getArgValue(args, '--output');

    const changelogPath = path.join(ROOT, 'CHANGELOG.md');
    const content = fs.existsSync(changelogPath)
      ? fs.readFileSync(changelogPath, 'utf8')
      : '';

    const extracted = extractChangelogSection(content, version);
    const formatted = formatReleaseNotes(version, extracted);

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

export { parseGitLog };
