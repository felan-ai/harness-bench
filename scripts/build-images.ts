#!/usr/bin/env bun
/**
 * Builds a *native* Docker image for each DeepSWE task from its verbatim
 * upstream `environment/Dockerfile`.
 *
 * Why: the prebuilt `swe-bench-202605` ECR images are linux/amd64 only, so on
 * an arm64 host they run under QEMU emulation (very slow). But every task's
 * `environment/Dockerfile` is `FROM public.ecr.aws/x8v8d7g8/mars-base:latest`,
 * and mars-base is multi-arch (has an arm64 variant). Rebuilding each task from
 * that Dockerfile therefore produces a native image for the host architecture.
 *
 * The resulting image is tagged `deepswe-task:<id>` and referenced as the
 * per-case `image:` (i.e. the managed-build base) by scripts/port-deep-swe.ts.
 * The existing seedFromImage flow extracts /app from it unchanged.
 *
 * Usage:
 *   bun scripts/build-images.ts --all                 # build every task
 *   bun scripts/build-images.ts --only a,b,c          # build specific task ids
 *   bun scripts/build-images.ts --all --force         # rebuild even if present
 *   bun scripts/build-images.ts --all --concurrency 4 # parallel builds
 *   bun scripts/build-images.ts --src <deep-swe-dir>  # alternate source
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseToml } from 'smol-toml';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));

const MARS_BASE = 'public.ecr.aws/x8v8d7g8/mars-base:latest';
export const IMAGE_PREFIX = 'deepswe-task';

export function imageTag(id: string): string {
  return `${IMAGE_PREFIX}:${id}`;
}

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

interface Task {
  id: string;
  dockerfileDir: string;
}

async function collectTasks(tasksDir: string): Promise<Task[]> {
  const entries = await readdir(tasksDir);
  const tasks: Task[] = [];
  for (const name of entries.sort()) {
    const taskDir = join(tasksDir, name);
    if (!(await isDir(taskDir))) continue;
    const tomlPath = join(taskDir, 'task.toml');
    try {
      await stat(tomlPath);
    } catch {
      continue;
    }
    const toml = parseToml(await readFile(tomlPath, 'utf8')) as { metadata?: { task_id?: string } };
    const id = toml.metadata?.task_id ?? name;
    const dockerfileDir = join(taskDir, 'environment');
    if (!(await isDir(dockerfileDir))) continue;
    try {
      await stat(join(dockerfileDir, 'Dockerfile'));
    } catch {
      continue;
    }
    tasks.push({ id, dockerfileDir });
  }
  return tasks;
}

function imageExists(tag: string): boolean {
  return spawnSync('docker', ['image', 'inspect', tag], { stdio: 'ignore' }).status === 0;
}

function buildImage(task: Task): Promise<{ id: string; ok: boolean; error?: string; override?: boolean }> {
  return new Promise((resolve) => {
    const tag = imageTag(task.id);
    // A few upstream Dockerfiles hardcode amd64-only steps (e.g. an amd64 deno
    // binary) or rely on packages with no arm64 build. If `overrides/<id>/Dockerfile`
    // exists, build from it instead of the upstream environment/Dockerfile.
    const overridePath = join(projectRoot, 'overrides', task.id, 'Dockerfile');
    const override = existsSync(overridePath);
    const buildArgs = override
      ? ['build', '-t', tag, '-f', overridePath, join(projectRoot, 'overrides', task.id)]
      : ['build', '-t', tag, task.dockerfileDir];
    // Use the host's native platform (omit --platform so a multi-arch base
    // resolves to the host arch). DOCKER_DEFAULT_PLATFORM, if set, still wins.
    const child = spawn('docker', buildArgs, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });
    const errChunks: Buffer[] = [];
    child.stdout?.on('data', () => {});
    child.stderr?.on('data', (c: Buffer) => errChunks.push(c));
    child.on('error', (e) => resolve({ id: task.id, ok: false, error: e.message, override }));
    child.on('close', (code) => {
      if (code === 0) return resolve({ id: task.id, ok: true, override });
      const tail = Buffer.concat(errChunks).toString('utf8').trim().split('\n').slice(-8).join('\n');
      resolve({ id: task.id, ok: false, error: tail || `docker build exited ${code}`, override });
    });
  });
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
  const tasksDir = join(srcRoot, 'tasks');
  if (!(await isDir(tasksDir))) {
    throw new Error(`DeepSWE tasks not found at ${tasksDir}. Clone it there or pass --src <dir>.`);
  }

  const all = await collectTasks(tasksDir);
  const onlyArg = arg('--only', '');
  const only = onlyArg ? new Set(onlyArg.split(',').map((s) => s.trim()).filter(Boolean)) : undefined;
  if (!only && !flag('--all')) {
    throw new Error('Specify --all or --only <id,id,...>');
  }
  const force = flag('--force');
  const concurrency = Number(arg('--concurrency', '3')) || 3;

  let selected = only ? all.filter((t) => only.has(t.id)) : all;
  if (only) {
    const found = new Set(selected.map((t) => t.id));
    const missing = [...only].filter((id) => !found.has(id));
    if (missing.length) throw new Error(`Unknown task id(s): ${missing.join(', ')}`);
  }

  const skipped = force ? [] : selected.filter((t) => imageExists(imageTag(t.id)));
  const skippedIds = new Set(skipped.map((t) => t.id));
  selected = selected.filter((t) => !skippedIds.has(t.id));

  if (skipped.length) {
    console.log(`Skipping ${skipped.length} already-built image(s) (use --force to rebuild).`);
  }
  if (selected.length === 0) {
    console.log('Nothing to build.');
    return;
  }

  // Warm the shared base layer once so parallel builds reuse it instead of
  // each pulling mars-base independently.
  console.log(`Pulling base image ${MARS_BASE} (host-native variant)...`);
  spawnSync('docker', ['pull', MARS_BASE], { stdio: 'inherit', env: process.env });

  console.log(`Building ${selected.length} native task image(s) at concurrency ${concurrency}...`);
  let done = 0;
  const results = await pool(selected, concurrency, async (task) => {
    const r = await buildImage(task);
    done += 1;
    const mark = r.override ? ' (override)' : '';
    console.log(`[${done}/${selected.length}] ${r.ok ? 'OK  ' : 'FAIL'} ${imageTag(task.id)}${mark}${r.ok ? '' : `\n      ${r.error?.replace(/\n/g, '\n      ')}`}`);
    return r;
  });

  const failed = results.filter((r) => !r.ok);
  console.log(`\nBuilt ${results.length - failed.length}/${results.length}. Failed: ${failed.length}.`);
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
