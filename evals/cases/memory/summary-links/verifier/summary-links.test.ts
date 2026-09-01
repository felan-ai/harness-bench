import { describe, expect, it } from 'vitest';
import {
  createMemoryProjectionSnapshot,
  createMemorySnapshot,
  validateMemoryArtifact,
} from '../src/index.js';

describe('memory summary links regression', () => {
  it('allows linked summaries without relaxing publication validation', () => {
    const complete = [
      { path: 'summary.md', content: '[Release](pages/workflows/release.md#checks)' },
      {
        path: 'index.md',
        content: '# Memory index\n\n## How to use this memory\n\n## Memory map\n- [Workflow](pages/workflows/index.md)\n',
      },
      { path: 'pages/workflows/index.md', content: '# Workflows\n\n- [Release](release.md)\n' },
      { path: 'pages/workflows/release.md', content: '# Release\n\n## Sources\n- session:session-1\n' },
    ];

    expect(validateMemoryArtifact(complete, {
      memoryPath: '/work/.memory',
      sourceSessionIds: ['session-1'],
    })).toMatchObject({ ok: true });

    const incomplete = validateMemoryArtifact([
      { path: 'summary.md', content: '[Release](pages/workflows/release.md#checks)' },
      { path: 'pages/workflows/release.md', content: '# Release without provenance' },
    ], { memoryPath: '/work/.memory' });
    expect(incomplete.ok).toBe(false);
    expect(incomplete.errors.map(({ code }) => code)).toEqual(expect.arrayContaining([
      'missing_required_file',
      'missing_sources',
    ]));

    const unknownSource = validateMemoryArtifact(complete.map((file) => ({
      ...file,
      content: file.content.replace('session:session-1', 'session:session-2'),
    })), {
      memoryPath: '/work/.memory',
      sourceSessionIds: ['session-1'],
    });
    expect(unknownSource.ok).toBe(false);
    expect(unknownSource.errors.map(({ code }) => code)).toContain('unknown_source');
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
    ]);
    expect(unsafe.ok).toBe(false);
    expect(unsafe.errors.map(({ code }) => code)).toContain('invalid_path');
  });

  it('rebases summary Markdown and wiki links without changing canonical memory', () => {
    const canonicalPath = '.memory';
    const projectionPath = '/sessions/root-1/.memory';
    const canonical = createMemorySnapshot([
      {
        path: 'summary.md',
        content: `Review [release](${canonicalPath}/pages/workflows/release.md#checks), [[${canonicalPath}/pages/workflows/index.md|workflow]], [external](https://example.com), [escape](../secrets.md#token), and [[../../outside.md|outside]].`,
      },
      {
        path: 'index.md',
        content: `# Memory index\n\n## How to use this memory\n\n## Memory map\n- [Workflow](${canonicalPath}/pages/workflows/index.md#overview)\n- [[${canonicalPath}/pages/workflows/release.md#checks|Release checks]]\n`,
      },
      { path: 'pages/workflows/index.md', content: '# Workflows\n\n- [Release](release.md)\n' },
      { path: 'pages/workflows/release.md', content: '# Release\n\n## Sources\n- session:session-1\n' },
    ], canonicalPath, { sourceSessionIds: ['session-1'] });

    const projection = createMemoryProjectionSnapshot(canonical, projectionPath);
    const summary = projection.files.find(({ path }) => path === 'summary.md')?.content;
    const index = projection.files.find(({ path }) => path === 'index.md')?.content;
    expect(summary).toContain(`[release](${projectionPath}/pages/workflows/release.md#checks)`);
    expect(summary).toContain(`[[${projectionPath}/pages/workflows/index.md|workflow]]`);
    expect(summary).toContain('[external](https://example.com)');
    expect(summary).toContain('[escape](../secrets.md#token)');
    expect(summary).toContain('[[../../outside.md|outside]]');
    expect(summary).not.toContain(`${projectionPath}/secrets.md`);
    expect(index).toContain(`[Workflow](${projectionPath}/pages/workflows/index.md#overview)`);
    expect(index).toContain(`[[${projectionPath}/pages/workflows/release.md#checks|Release checks]]`);
    expect(projection.fingerprint).toBe(canonical.fingerprint);
    expect(canonical.files.find(({ path }) => path === 'summary.md')?.content).toContain(`(${canonicalPath}/pages/workflows/release.md#checks)`);
    expect(canonical.files.find(({ path }) => path === 'index.md')?.content).toContain(`(${canonicalPath}/pages/workflows/index.md#overview)`);
  });
});
