import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';

if (process.argv.length !== 2) {
  console.error('Usage: bun run build:runtime');
  process.exit(1);
}

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const runtime = 'felan';
const dockerfile = join('evals', 'runtimes', runtime, 'Dockerfile');

if (!existsSync(join(projectRoot, dockerfile))) {
  console.error(`Runtime Dockerfile does not exist at ${dockerfile}`);
  process.exit(1);
}

const result = spawnSync(
  'docker',
  ['build', '-f', dockerfile, '-t', `harness-bench-${runtime}-runtime:v1`, '.'],
  { cwd: projectRoot, stdio: 'inherit' },
);

if (result.error) {
  console.error(`Failed to start Docker: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
