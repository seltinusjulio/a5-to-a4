import { describe, it, expect } from 'vitest';
import {
  normalizeVersion,
  promoteUnreleasedChangelog,
  extractChangelogSection,
} from '../../../scripts/release.mjs';

const sampleChangelog = `# Changelog

## [Unreleased]

### Ditambahkan
- Fitur portabel Windows offline.

## [1.0.0] - 2026-11-28

### Ditambahkan
- Rilis perdana Katern.
`;

describe('release & changelog automation script', () => {
  it('normalizes valid semver versions with or without v prefix', () => {
    expect(normalizeVersion('1.2.3')).toBe('1.2.3');
    expect(normalizeVersion('v2.0.0-beta.1')).toBe('2.0.0-beta.1');
    expect(() => normalizeVersion('invalid')).toThrow(/Versi tidak valid/);
  });

  it('promotes [Unreleased] entries into a dated release section', () => {
    const promoted = promoteUnreleasedChangelog(sampleChangelog, 'v1.1.0', '2026-12-01');
    expect(promoted).toContain('## [Unreleased]\n\n## [1.1.0] - 2026-12-01');
    expect(promoted).toContain('- Fitur portabel Windows offline.');
    expect(promoted).toContain('## [1.0.0] - 2026-11-28');
  });

  it('extracts release notes accurately for a requested version tag', () => {
    const notes = extractChangelogSection(sampleChangelog, 'v1.0.0');
    expect(notes).toContain('### Ditambahkan');
    expect(notes).toContain('Rilis perdana Katern.');
    expect(notes).not.toContain('Fitur portabel');
    expect(extractChangelogSection(sampleChangelog, '9.9.9')).toBeNull();
  });
});
