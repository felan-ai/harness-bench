import { copyFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const workspace = '/workspace';
const rewardPath = `${workspace}/.harness-evals-reward.txt`;
const hiddenMemoryTest = `${workspace}/packages/ext-memory/test/harness-summary-links.test.ts`;
const hiddenStoreTest = `${workspace}/apps/tui/test/harness-memory-store.test.ts`;
const allowedPrefixes = ['packages/ext-memory/src/', 'apps/tui/src/memory/'];

let passed = false;
try {
  verifyWorkspaceBoundary();
  await copyFile('/tests/summary-links.test.ts', hiddenMemoryTest);
  await copyFile('/tests/memory-store.test.ts', hiddenStoreTest);
  run('pnpm', ['--filter', '@felan-ai/felan...', 'build']);
  run('pnpm', ['--filter', '@felan-ai/ext-memory', 'type-check']);
  run('pnpm', [
    '--filter',
    '@felan-ai/ext-memory',
    'exec',
    'vitest',
    'run',
    'test/package.test.ts',
    'test/manifest.test.ts',
    'test/harness-summary-links.test.ts',
  ]);
  run('pnpm', ['--filter', '@felan-ai/felan', 'type-check']);
  run('pnpm', [
    '--filter',
    '@felan-ai/felan',
    'exec',
    'vitest',
    'run',
    'test/memory-store.test.ts',
    'test/harness-memory-store.test.ts',
  ]);
  passed = true;
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
} finally {
  await Promise.all([
    rm(hiddenMemoryTest, { force: true }),
    rm(hiddenStoreTest, { force: true }),
  ]);
  await writeFile(rewardPath, passed ? '1\n' : '0\n');
}

console.log(passed ? '1' : '0');
if (!passed) process.exitCode = 1;

function verifyWorkspaceBoundary() {
  const head = capture('git', ['rev-parse', 'HEAD']).trim();
  if (head !== '0b461533f86c4d58521cdd7da7d9f298da03b123') {
    throw new Error('repository history changed');
  }
  if (capture('git', ['remote']).trim() !== '') {
    throw new Error('benchmark workspace unexpectedly has a Git remote');
  }
  const changedPaths = capture('git', ['status', '--porcelain=v1', '--untracked-files=all'])
    .split(/\r?\n/u)
    .filter(Boolean)
    .flatMap((line) => line.slice(3).split(' -> '));
  if (changedPaths.length === 0) throw new Error('no implementation changes found');
  const disallowed = changedPaths.filter((path) => !allowedPrefixes.some((prefix) => path.startsWith(prefix)));
  if (disallowed.length > 0) throw new Error(`changes outside allowed memory sources: ${disallowed.join(', ')}`);
}

function capture(command, args) {
  const result = spawnSync(command, args, { cwd: workspace, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 30_000 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed:\n${result.stderr || result.stdout}`);
  return result.stdout;
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: workspace, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 240_000 });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} exited with ${result.status}`);
}
