import { describe, it, expect } from 'vitest';
import {
  normalizeVersion,
  bumpSemver,
  determineBumpType,
  resolveNextVersion,
  promoteUnreleasedChangelog,
  extractChangelogSection,
  extractExistingChangelogVersions,
  formatReleaseNotes,
} from '../../../scripts/release.mjs';

const sampleChangelog = `# Changelog

## [Unreleased]

### Ditambahkan
- Fitur portabel Windows offline.

## [1.0.0] - 2026-11-28

### Ditambahkan
- Rilis perdana Katern.
`;

describe('release & auto-versioning script', () => {
  it('normalizes valid semver versions with or without v prefix', () => {
    expect(normalizeVersion('1.2.3')).toBe('1.2.3');
    expect(normalizeVersion('v2.0.0-beta.1')).toBe('2.0.0-beta.1');
    expect(() => normalizeVersion('invalid')).toThrow(/Versi tidak valid/);
  });

  it('computes SemVer bumps accurately for major, minor, and patch', () => {
    expect(bumpSemver('1.2.3', 'patch')).toBe('1.2.4');
    expect(bumpSemver('1.2.3', 'minor')).toBe('1.3.0');
    expect(bumpSemver('1.2.3', 'major')).toBe('2.0.0');
  });

  it('determines bump type from Conventional Commits and BREAKING CHANGE markers', () => {
    expect(determineBumpType([])).toBe('none');
    expect(
      determineBumpType([
        { subject: 'fix(crop): perbaiki deteksi margin' },
        { subject: 'chore(ci): rapikan workflow' },
      ])
    ).toBe('patch');
    expect(
      determineBumpType([
        { subject: 'fix: perbaikan kecil' },
        { subject: 'feat(3d): tambah kamera otomatis' },
      ])
    ).toBe('minor');
    expect(
      determineBumpType([
        { subject: 'feat!: ubah format ekspor' },
      ])
    ).toBe('major');
    expect(
      determineBumpType([
        { subject: 'refactor: struktur baru', body: 'BREAKING CHANGE: API berubah' },
      ])
    ).toBe('major');
  });

  it('resolves next version safely without colliding with existing tags or CHANGELOG entries', () => {
    const existingChangelogVersions = extractExistingChangelogVersions(sampleChangelog);
    expect(existingChangelogVersions.has('1.0.0')).toBe(true);

    // Next minor from 1.0.0 when v1.1.0 tag already exists -> skips to 1.1.1
    const next = resolveNextVersion({
      packageVersion: '1.0.0',
      latestTag: 'v1.0.0',
      existingTags: ['v1.0.0', 'v1.1.0'],
      existingChangelogVersions,
      bumpType: 'minor',
    });
    expect(next).toBe('1.1.1');
  });

  it('promotes [Unreleased] entries into a dated release section', () => {
    const promoted = promoteUnreleasedChangelog(sampleChangelog, 'v1.1.0', '2026-12-01');
    expect(promoted).toContain('## [Unreleased]\n\n## [1.1.0] - 2026-12-01');
    expect(promoted).toContain('- Fitur portabel Windows offline.');
    expect(promoted).toContain('## [1.0.0] - 2026-11-28');
  });

  it('extracts and formats release notes accurately for a requested version tag', () => {
    const notes = extractChangelogSection(sampleChangelog, 'v1.0.0');
    expect(notes).toContain('### Ditambahkan');
    expect(notes).toContain('Rilis perdana Katern.');
    expect(notes).not.toContain('Fitur portabel');
    expect(extractChangelogSection(sampleChangelog, '9.9.9')).toBeNull();

    const formatted = formatReleaseNotes('1.0.0', notes);
    expect(formatted).toContain('Katern v1.0.0 — Windows Portabel (Offline)');
    expect(formatted).toContain('Katern-v1.0.0-windows-x64-portable.zip');
  });
});
