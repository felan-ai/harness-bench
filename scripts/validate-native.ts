#!/usr/bin/env bun
/**
 * Validates the *native* per-task images produced by scripts/build-images.ts by
 * exercising the task's own verifier (tests/run.sh -> test.sh) directly, offline
 * (--network none, mirroring the air-gapped grading), in two states:
 *
 *   unmodified  -> expect reward 0, baseline tests pass, new tests fail
 *   solution    -> expect reward 1, baseline tests pass, new tests pass
 *                  (applies third_party/deep-swe/tasks/<id>/solution/solution.patch)
 *
 * Passing both proves the native environment is correct (toolchain + deps work
 * offline, baseline is green) AND that the hidden tests actually discriminate
 * the fix. The image must already be built (bun scripts/build-images.ts --only <id>).
 *
 * Usage:
 *   bun scripts/validate-native.ts --only a,b,c
 *   bun scripts/validate-native.ts --all
 *   bun scripts/validate-native.ts --only a --concurrency 2
 */
import { spawn } from 'node:child_process';
import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseToml } from 'smol-toml';
import { imageTag } from './build-images.ts';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));

function flag(name: string): boolean {
  return process.argv.includes(name);
}
function arg(name: string, fallback: string): string {
  const idx = process.argv.indexOf(name);
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : fallback;
}
async function isDir(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

interface RunOut {
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

function dockerRun(args: string[], timeoutMs = 1_800_000): Promise<RunOut> {
  return new Promise((resolve) => {
    const child = spawn('docker', args, { stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    child.stdout?.on('data', (c: Buffer) => out.push(c));
    child.stderr?.on('data', (c: Buffer) => err.push(c));
    const t = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.on('close', (code) => {
      clearTimeout(t);
      resolve({ exitCode: code, stdout: Buffer.concat(out).toString('utf8'), stderr: Buffer.concat(err).toString('utf8') });
    });
    child.on('error', () => {
      clearTimeout(t);
      resolve({ exitCode: null, stdout: Buffer.concat(out).toString('utf8'), stderr: Buffer.concat(err).toString('utf8') });
    });
  });
}

interface Check {
  reward: number | null;
  baseline: number | null;
  newTests: number | null;
  raw: string;
}

function parse(out: RunOut): Check {
  const text = `${out.stdout}\n${out.stderr}`;
  const num = (re: RegExp): number | null => {
    const m = text.match(re);
    return m ? Number(m[1]) : null;
  };
  return {
    reward: num(/__REWARD__=(\d+)/),
    baseline: num(/Baseline exit code:\s*(\d+)/),
    newTests: num(/New tests exit code:\s*(\d+)/),
    raw: text,
  };
}

// Shell run inside the native image. `pre` is extra commands (e.g. apply
// solution) run before the verifier. The verifier (run.sh) writes the reward to
// /app/.harness-evals-reward.txt; we echo it with a sentinel for parsing.
function verifierScript(pre: string): string {
  return [
    'set -uo pipefail',
    'git config --global --add safe.directory /app 2>/dev/null || true',
    'cd /app || exit 90',
    pre,
    'bash /tests/run.sh',
    'echo "__REWARD__=$(cat /app/.harness-evals-reward.txt 2>/dev/null || echo NA)"',
  ].filter(Boolean).join('\n');
}

async function runState(id: string, assetsDir: string, solutionDir: string | null): Promise<Check> {
  const tag = imageTag(id);
  const args = ['run', '--rm', '--network', 'none', '--mount', `type=bind,source=${assetsDir},target=/tests,readonly`];
  let pre = '';
  if (solutionDir) {
    args.push('--mount', `type=bind,source=${solutionDir},target=/solution,readonly`);
    pre = 'git apply --whitespace=nowarn /solution/solution.patch || exit 91';
  }
  args.push(tag, 'bash', '-c', verifierScript(pre));
  return parse(await dockerRun(args));
}

interface Result {
  id: string;
  ok: boolean;
  notes: string[];
}

async function validateTask(id: string): Promise<Result> {
  const notes: string[] = [];
  const assetsDir = join(projectRoot, 'evals', id);
  const solutionPatch = join(projectRoot, 'third_party/deep-swe/tasks', id, 'solution', 'solution.patch');
  const solutionDir = join(projectRoot, 'third_party/deep-swe/tasks', id, 'solution');

  if (!(await isDir(assetsDir))) {
    return { id, ok: false, notes: [`missing assets dir ${assetsDir} (run port-deep-swe.ts)`] };
  }
  const hasSolution = await stat(solutionPatch).then(() => true).catch(() => false);

  const [unmod, sol] = await Promise.all([
    runState(id, assetsDir, null),
    hasSolution ? runState(id, assetsDir, solutionDir) : Promise.resolve(null),
  ]);

  // Unmodified: reward 0, baseline green, new tests fail.
  let ok = true;
  if (unmod.reward !== 0) { ok = false; notes.push(`unmodified reward=${unmod.reward ?? 'NA'} (want 0)`); }
  if (unmod.baseline !== 0) { ok = false; notes.push(`unmodified baseline=${unmod.baseline ?? 'NA'} (want 0 -> env/base broken)`); }
  if (unmod.newTests === 0) { ok = false; notes.push(`unmodified new tests passed unexpectedly (non-discriminating)`); }

  // Solution: reward 1, baseline green, new tests pass.
  if (sol) {
    if (sol.reward !== 1) { ok = false; notes.push(`solution reward=${sol.reward ?? 'NA'} (want 1)`); }
    if (sol.baseline !== 0) { ok = false; notes.push(`solution baseline=${sol.baseline ?? 'NA'} (want 0)`); }
    if (sol.newTests !== 0) { ok = false; notes.push(`solution new tests=${sol.newTests ?? 'NA'} (want 0)`); }
  } else {
    notes.push('no solution.patch; only unmodified checked');
  }

  if (ok && notes.length === 0) notes.push(`unmod r0/base0/new${unmod.newTests}, solution r1/base0/new0`);
  return { id, ok, notes };
}

async function collectAllIds(tasksDir: string): Promise<string[]> {
  const entries = await readdir(tasksDir);
  const ids: string[] = [];
  for (const name of entries.sort()) {
    const tomlPath = join(tasksDir, name, 'task.toml');
    try {
      const toml = parseToml(await readFile(tomlPath, 'utf8')) as { metadata?: { task_id?: string } };
      ids.push(toml.metadata?.task_id ?? name);
    } catch {
      // not a task dir
    }
  }
  return ids;
}

async function pool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(size, items.length || 1)) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i]);
      }
    }),
  );
  return results;
}

async function main(): Promise<void> {
  const srcRoot = arg('--src', join(projectRoot, 'third_party/deep-swe'));
  const onlyArg = arg('--only', '');
  const concurrency = Number(arg('--concurrency', '2')) || 2;

  let ids: string[];
  if (onlyArg) ids = onlyArg.split(',').map((s) => s.trim()).filter(Boolean);
  else if (flag('--all')) ids = await collectAllIds(join(srcRoot, 'tasks'));
  else throw new Error('Specify --all or --only <id,id,...>');

  console.log(`Validating ${ids.length} task(s) offline against native images (concurrency ${concurrency})...`);
  let done = 0;
  const results = await pool(ids, concurrency, async (id) => {
    const r = await validateTask(id);
    done += 1;
    console.log(`[${done}/${ids.length}] ${r.ok ? 'PASS' : 'FAIL'} ${id} :: ${r.notes.join('; ')}`);
    return r;
  });

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} validated. Failed: ${failed.length}.`);
  if (failed.length) {
    console.log(`Failed ids:\n  ${failed.map((r) => r.id).join('\n  ')}`);
    process.exit(1);
  }
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
