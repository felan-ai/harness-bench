import { describe, expect, it } from 'vitest';
import {
  createMemoryProjectionSnapshot,
  createMemorySnapshot,
  validateMemoryArtifact,
} from '../src/index.js';

describe('memory summary links regression', () => {
  it('normalizes incomplete linked memory in read mode but keeps strict publication validation', () => {
    const files = [
      { path: 'summary.md', content: '[Release](pages/workflows/release.md#checks)' },
      { path: 'pages/workflows/release.md', content: '# Release without provenance' },
    ];

    expect(validateMemoryArtifact(files, { memoryPath: '/work/.memory', mode: 'read' })).toMatchObject({ ok: true });
    const strict = validateMemoryArtifact(files, { memoryPath: '/work/.memory' });
    expect(strict.ok).toBe(false);
    expect(strict.errors.map(({ code }) => code)).toEqual(expect.arrayContaining([
      'missing_required_file',
      'missing_sources',
    ]));
  });

  it('treats summary links as orientation without relaxing path safety', () => {
    const result = validateMemoryArtifact([
      {
        path: 'summary.md',
        content: 'Review [missing](pages/workflows/missing.md), [external](https://example.com), and [[%ZZ|malformed]].',
      },
      {
        path: 'index.md',
        content: '# Memory index\n\n## How to use this memory\n\n## Memory map\n- [Workflow](pages/workflows/index.md)\n',
      },
      { path: 'pages/workflows/index.md', content: '# Workflows\n\n- [Release](release.md)\n' },
      { path: 'pages/workflows/release.md', content: '# Release\n\n## Sources\n- session:session-1\n' },
    ], { sourceSessionIds: ['session-1'] });
    expect(result).toMatchObject({ ok: true });

    const unsafe = validateMemoryArtifact([
      { path: '../summary.md', content: 'unsafe' },
    ], { mode: 'read' });
    expect(unsafe.ok).toBe(false);
    expect(unsafe.errors.map(({ code }) => code)).toContain('invalid_path');
  });

  it('rebases summary Markdown and wiki links without changing canonical memory', () => {
    const canonicalPath = '.memory';
    const projectionPath = '/sessions/root-1/.memory';
    const canonical = createMemorySnapshot([
      {
        path: 'summary.md',
        content: `Review [release](${canonicalPath}/pages/workflows/release.md#checks), [[${canonicalPath}/pages/workflows/index.md|workflow]], and [external](https://example.com).`,
      },
      {
        path: 'index.md',
        content: `# Memory index\n\n## How to use this memory\n\n## Memory map\n- [Workflow](${canonicalPath}/pages/workflows/index.md)\n`,
      },
      { path: 'pages/workflows/index.md', content: '# Workflows\n\n- [Release](release.md)\n' },
      { path: 'pages/workflows/release.md', content: '# Release\n\n## Sources\n- session:session-1\n' },
    ], canonicalPath, { sourceSessionIds: ['session-1'] });

    const projection = createMemoryProjectionSnapshot(canonical, projectionPath);
    const summary = projection.files.find(({ path }) => path === 'summary.md')?.content;
    expect(summary).toContain(`[release](${projectionPath}/pages/workflows/release.md#checks)`);
    expect(summary).toContain(`[[${projectionPath}/pages/workflows/index.md|workflow]]`);
    expect(summary).toContain('[external](https://example.com)');
    expect(projection.fingerprint).toBe(canonical.fingerprint);
    expect(canonical.files.find(({ path }) => path === 'summary.md')?.content).toContain(`(${canonicalPath}/pages/workflows/release.md#checks)`);
  });
});
