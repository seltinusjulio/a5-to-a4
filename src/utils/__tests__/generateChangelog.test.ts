import { describe, it, expect } from 'vitest';
import {
  shouldSkipCommit,
  categorizeCommit,
  parseGitLog,
  mergeCommitsIntoChangelog,
} from '../../../scripts/generate-changelog.js';

describe('generate-changelog script', () => {
  it('skips automated changelog, release, merge, and skip-ci commits', () => {
    expect(shouldSkipCommit('chore(changelog): perbarui CHANGELOG.md otomatis [skip ci]')).toBe(true);
    expect(shouldSkipCommit('chore(release): v1.1.0')).toBe(true);
    expect(shouldSkipCommit('Merge pull request #12 from user/feature')).toBe(true);
    expect(shouldSkipCommit('Update README [skip ci]')).toBe(true);
    expect(shouldSkipCommit('feat(viewer): tambah kontrol zoom 3D')).toBe(false);
  });

  it('categorizes Conventional Commits and plain messages accurately', () => {
    expect(categorizeCommit('feat(preview): tambah mode cetak bolak-balik')).toEqual({
      category: 'Ditambahkan',
      description: '**preview:** Tambah mode cetak bolak-balik',
    });

    expect(categorizeCommit('fix: perbaiki posisi garis lipatan A4')).toEqual({
      category: 'Diperbaiki',
      description: 'Perbaiki posisi garis lipatan A4',
    });

    expect(categorizeCommit('ci(actions): tambah workflow portabel')).toEqual({
      category: 'Pemeliharaan',
      description: '**actions:** Tambah workflow portabel',
    });

    expect(categorizeCommit('rapikan tampilan tombol unduh')).toEqual({
      category: 'Diubah',
      description: 'Rapikan tampilan tombol unduh',
    });
  });

  it('parses git log output and filters skipped commits', () => {
    const raw = [
      'abc1234\x1f2026-11-28\x1ffeat: tambah ekspor portabel',
      'def5678\x1f2026-11-28\x1fchore(changelog): auto update [skip ci]',
      '9876543\x1f2026-11-27\x1ffix(crop): perbaiki margin putih',
    ].join('\n');

    const commits = parseGitLog(raw);
    expect(commits).toHaveLength(2);
    expect(commits[0]).toEqual({
      hash: 'abc1234',
      date: '2026-11-28',
      subject: 'feat: tambah ekspor portabel',
    });
    expect(commits[1].hash).toBe('9876543');
  });

  it('merges new commits into [Unreleased], deduplicates by hash, and preserves older releases', () => {
    const existing = `# Changelog

## [Unreleased]

### Ditambahkan
- Fitur manual sebelumnya.

## [1.0.0] - 2026-11-28

### Ditambahkan
- Rilis perdana (\`111aaaa\` — 2026-11-28)
`;

    const commits = [
      { hash: '222bbbb', date: '2026-11-29', subject: 'feat(desktop): dukung dialog simpan Windows' },
      { hash: '333cccc', date: '2026-11-29', subject: 'fix: perbaiki rasio halaman A5' },
      { hash: '111aaaa', date: '2026-11-28', subject: 'feat: rilis perdana' }, // already in 1.0.0 -> deduped
    ];

    const firstPass = mergeCommitsIntoChangelog(existing, commits);
    expect(firstPass.addedCount).toBe(2);
    expect(firstPass.content).toContain('- **desktop:** Dukung dialog simpan Windows (`222bbbb` — 2026-11-29)');
    expect(firstPass.content).toContain('- Fitur manual sebelumnya.');
    expect(firstPass.content).toContain('### Diperbaiki\n- Perbaiki rasio halaman A5 (`333cccc` — 2026-11-29)');
    expect(firstPass.content).toContain('## [1.0.0] - 2026-11-28');

    // Re-running with the same commits must be a no-op (idempotent)
    const secondPass = mergeCommitsIntoChangelog(firstPass.content, commits);
    expect(secondPass.addedCount).toBe(0);
    expect(secondPass.content).toBe(firstPass.content);
  });
});
