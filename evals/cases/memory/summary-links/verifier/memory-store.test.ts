import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { LocalMemoryStore } from '../src/memory/store.js';

const temporaryPaths: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe('local memory linked-summary recovery', () => {
  it('keeps incomplete linked memory readable and projectable', async () => {
    const root = await mkdtemp(join(tmpdir(), 'felan-memory-store-'));
    temporaryPaths.push(root);
    const project = { canonicalRoot: join(root, 'workspace'), key: '1'.repeat(64) };
    await mkdir(project.canonicalRoot, { recursive: true });
    const store = new LocalMemoryStore(join(root, 'agent'), project);
    await store.initialize();

    await writeFile(join(store.currentDirectory, 'summary.md'), '[Release](pages/workflows/release.md)', 'utf8');
    await writeFile(join(store.currentDirectory, 'index.md'), '# Incomplete index', 'utf8');
    await mkdir(join(store.currentDirectory, 'pages', 'workflows'), { recursive: true });
    await writeFile(
      join(store.currentDirectory, 'pages', 'workflows', 'release.md'),
      '# Release without navigation or provenance',
      'utf8',
    );

    await expect(store.readCurrent()).resolves.toMatchObject({
      files: expect.arrayContaining([
        { path: 'summary.md', content: '[Release](pages/workflows/release.md)' },
        { path: 'pages/workflows/release.md', content: '# Release without navigation or provenance' },
      ]),
    });

    const projection = await store.projectTo(join(root, 'session'));
    await expect(readFile(join(projection.memoryPath, 'summary.md'), 'utf8')).resolves.toContain(
      `${projection.memoryPath}/pages/workflows/release.md`,
    );
  });
});
