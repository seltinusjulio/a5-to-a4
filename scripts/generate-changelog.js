#!/usr/bin/env node
/**
 * Automatic Git-to-CHANGELOG.md generator for BukuCepat.
 *
 * Reads recent commits from git history (since the latest tag, or recent commits),
 * categorizes them cleanly under `## [Unreleased]` in CHANGELOG.md, deduplicates by
 * short commit hash, and skips automated/release commits to prevent CI loops.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const CATEGORY_ORDER = ['Ditambahkan', 'Diubah', 'Diperbaiki', 'Pemeliharaan'];

const SKIP_PATTERNS = [
  /\[skip ci\]/i,
  /\[ci skip\]/i,
  /^chore\(changelog\):/i,
  /^chore\(release\):/i,
  /^merge (branch|pull request|remote-tracking branch)/i,
  /^revert\s+"/i,
];

const DEFAULT_HEADER = `# Changelog

Semua perubahan penting pada **BukuCepat** dicatat dalam berkas ini.

Format mengikuti [Keep a Changelog](https://keepachangelog.com/id/1.1.0/) dan penomoran versi mengikuti [Semantic Versioning](https://semver.org/).

## [Unreleased]
`;

export function shouldSkipCommit(subject) {
  const trimmed = String(subject || '').trim();
  if (!trimmed) return true;
  return SKIP_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function categorizeCommit(subject) {
  const trimmed = String(subject || '').trim();
  const conventional = trimmed.match(/^([a-zA-Z]+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/);

  if (!conventional) {
    return {
      category: 'Diubah',
      description: formatDescription(trimmed),
    };
  }

  const type = conventional[1].toLowerCase();
  const scope = conventional[2]?.trim();
  const rawDesc = conventional[4].trim();

  let category = 'Diubah';
  if (type === 'feat') {
    category = 'Ditambahkan';
  } else if (type === 'fix') {
    category = 'Diperbaiki';
  } else if (['docs', 'chore', 'ci', 'build', 'test'].includes(type)) {
    category = 'Pemeliharaan';
  }

  const formatted = formatDescription(rawDesc);
  return {
    category,
    description: scope ? `**${scope}:** ${formatted}` : formatted,
  };
}

function formatDescription(text) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return clean;
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

export function parseGitLog(rawLog) {
  if (!rawLog || !rawLog.trim()) return [];
  const commits = [];

  for (const line of rawLog.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const [hash, date, ...subjectParts] = line.split('\x1f');
    const subject = subjectParts.join('\x1f').trim();
    if (!hash || !subject) continue;
    if (shouldSkipCommit(subject)) continue;

    commits.push({
      hash: hash.trim(),
      date: (date || '').trim(),
      subject,
    });
  }

  return commits;
}

export function mergeCommitsIntoChangelog(existingContent, commits) {
  const baseContent =
    existingContent && existingContent.trim().length > 0
      ? existingContent
      : DEFAULT_HEADER;

  // Filter out commits whose short hash is already recorded anywhere in CHANGELOG.md
  const newCommits = commits.filter((c) => {
    const escapedHash = c.hash.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const hashPattern = new RegExp(`\\(\`${escapedHash}\`(?:\\)|\\s)`);
    return !hashPattern.test(baseContent);
  });

  if (newCommits.length === 0) {
    return { content: baseContent, addedCount: 0 };
  }

  // Locate or inject ## [Unreleased]
  let content = baseContent;
  const unreleasedRe = /^## \[Unreleased\][ \t]*\r?\n?/m;
  let match = unreleasedRe.exec(content);
  if (!match) {
    const firstVersionRe = /^## \[/m;
    const verMatch = firstVersionRe.exec(content);
    if (verMatch) {
      content = `${content.slice(0, verMatch.index)}## [Unreleased]\n\n${content.slice(verMatch.index)}`;
    } else {
      content = `${content.trimEnd()}\n\n## [Unreleased]\n`;
    }
    match = unreleasedRe.exec(content);
  }

  const sectionStart = match.index + match[0].length;
  const afterUnreleased = content.slice(sectionStart);
  const nextReleaseMatch = /^## \[/m.exec(afterUnreleased);
  const unreleasedRaw = nextReleaseMatch
    ? afterUnreleased.slice(0, nextReleaseMatch.index)
    : afterUnreleased;
  const trailing = nextReleaseMatch
    ? afterUnreleased.slice(nextReleaseMatch.index)
    : '';

  // Parse existing subsections inside ## [Unreleased]
  const buckets = new Map();
  let currentHeading = null;

  for (const line of unreleasedRaw.split(/\r?\n/)) {
    const headingMatch = line.match(/^###\s+(.+?)\s*$/);
    if (headingMatch) {
      currentHeading = headingMatch[1];
      if (!buckets.has(currentHeading)) {
        buckets.set(currentHeading, []);
      }
      continue;
    }

    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    if (!currentHeading) {
      currentHeading = 'Diubah';
      if (!buckets.has(currentHeading)) {
        buckets.set(currentHeading, []);
      }
    }
    buckets.get(currentHeading).push(trimmedLine);
  }

  // Group new commits into categories (prepend newest first inside each category)
  const groupedNew = new Map();
  for (const commit of newCommits) {
    const { category, description } = categorizeCommit(commit.subject);
    const dateSuffix = commit.date ? ` — ${commit.date}` : '';
    const entry = `- ${description} (\`${commit.hash}\`${dateSuffix})`;

    if (!groupedNew.has(category)) {
      groupedNew.set(category, []);
    }
    groupedNew.get(category).push(entry);
  }

  for (const [category, entries] of groupedNew.entries()) {
    const existing = buckets.get(category) || [];
    buckets.set(category, [...entries, ...existing]);
  }

  // Rebuild ## [Unreleased] in deterministic category order
  const orderedHeadings = [
    ...CATEGORY_ORDER.filter((h) => buckets.has(h) && buckets.get(h).length > 0),
    ...[...buckets.keys()].filter(
      (h) => !CATEGORY_ORDER.includes(h) && buckets.get(h).length > 0
    ),
  ];

  const rebuiltUnreleased = orderedHeadings
    .map((heading) => `### ${heading}\n${buckets.get(heading).join('\n')}`)
    .join('\n\n');

  const prefix = content.slice(0, match.index);
  const trailingBlock = trailing ? `\n\n${trailing.replace(/^\r?\n+/, '')}` : '\n';
  const finalContent = `${prefix}## [Unreleased]\n\n${rebuiltUnreleased}${trailingBlock}`;

  return {
    content: finalContent.endsWith('\n') ? finalContent : `${finalContent}\n`,
    addedCount: newCommits.length,
  };
}

function runGit(args, cwd) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

export function getRecentGitCommits(rootDir = ROOT, maxCount = 30) {
  try {
    runGit(['rev-parse', '--is-inside-work-tree'], rootDir);
  } catch {
    return null;
  }

  let range = null;
  try {
    const latestTag = runGit(['describe', '--tags', '--abbrev=0'], rootDir);
    if (latestTag) {
      const commitsSinceTag = runGit(
        ['log', `${latestTag}..HEAD`, '--no-merges', '--pretty=format:%h%x1f%ad%x1f%s', '--date=short'],
        rootDir
      );
      if (commitsSinceTag) {
        return parseGitLog(commitsSinceTag);
      }
      range = latestTag;
    }
  } catch {
    // No tags yet — fall back to recent commit history
  }

  try {
    const fallbackLog = runGit(
      ['log', `-n`, String(maxCount), '--no-merges', '--pretty=format:%h%x1f%ad%x1f%s', '--date=short'],
      rootDir
    );
    const parsed = parseGitLog(fallbackLog);
    // If HEAD is already tagged and had no new commits after the tag, avoid flooding old commits
    return range ? parsed.slice(0, 5) : parsed;
  } catch {
    return [];
  }
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const maxArgIdx = args.indexOf('--max');
  const maxCount = maxArgIdx !== -1 ? Math.max(1, Number(args[maxArgIdx + 1]) || 30) : 30;

  const commits = getRecentGitCommits(ROOT, maxCount);
  if (commits === null) {
    console.log('Direktori ini bukan repositori Git — pembaruan CHANGELOG.md dilewati.');
    return;
  }

  if (commits.length === 0) {
    console.log('Tidak ada commit baru untuk ditambahkan ke CHANGELOG.md.');
    return;
  }

  const changelogPath = path.join(ROOT, 'CHANGELOG.md');
  const existing = fs.existsSync(changelogPath)
    ? fs.readFileSync(changelogPath, 'utf8')
    : DEFAULT_HEADER;

  const { content, addedCount } = mergeCommitsIntoChangelog(existing, commits);

  if (addedCount === 0) {
    console.log('CHANGELOG.md sudah sinkron dengan riwayat commit terbaru.');
    return;
  }

  if (dryRun) {
    console.log(`[dry-run] ${addedCount} commit baru akan ditambahkan ke CHANGELOG.md.`);
    return;
  }

  fs.writeFileSync(changelogPath, content, 'utf8');
  console.log(`CHANGELOG.md diperbarui otomatis dengan ${addedCount} commit terbaru.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  try {
    main();
  } catch (err) {
    console.error(`Gagal memperbarui CHANGELOG.md: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
