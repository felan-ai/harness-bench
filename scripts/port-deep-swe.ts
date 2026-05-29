#!/usr/bin/env bun
/**
 * Ports DeepSWE (Harbor-format) tasks into harness-evals test cases.
 *
 * For each task it emits one self-contained folder under evals/:
 *   evals/<id>/<id>.yaml             - the harness-evals case
 *   evals/<id>/test.sh, test.patch   - the task's hidden verifier assets, copied
 *                                      verbatim from DeepSWE
 *   evals/<id>/run.sh                - wrapper that surfaces reward.txt to /app
 * The whole folder is mounted read-only at /tests in the verifier (assetsDir).
 *
 * Usage: bun scripts/port-deep-swe.ts [--src <deep-swe-dir>]
 */
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseToml } from 'smol-toml';
import { stringify as stringifyYaml } from 'yaml';
import { imageTag } from './build-images.ts';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));

function arg(name: string, fallback: string): string {
  const idx = process.argv.indexOf(name);
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : fallback;
}

const srcRoot = arg('--src', join(projectRoot, 'third_party/deep-swe'));
const tasksDir = join(srcRoot, 'tasks');
const casesOutDir = join(projectRoot, 'evals');

// Wrapper run as the verifier command. DeepSWE's own test.sh already cd's to
// /app, reads /tests/test.patch, and writes /logs/verifier/reward.txt. We just
// make the expected dirs and copy the reward into the bind-mounted /app so the
// harness-evals runner can read it from the host via verifier.rewardFile.
const RUN_WRAPPER = `#!/bin/bash
set -uo pipefail
mkdir -p /logs/verifier /logs/artifacts
bash /tests/test.sh
rc=$?
if [ -f /logs/verifier/reward.txt ]; then
  cp /logs/verifier/reward.txt /app/.harness-evals-reward.txt
else
  echo 0 > /app/.harness-evals-reward.txt
fi
exit $rc
`;

interface TaskToml {
  metadata?: {
    task_id?: string;
    display_title?: string;
    display_description?: string;
    language?: string;
    base_commit_hash?: string;
  };
  environment?: { docker_image?: string; allow_internet?: boolean };
  verifier?: { timeout_sec?: number };
  agent?: { timeout_sec?: number };
}

function secToMs(sec: number | undefined, fallbackMs: number): number {
  return typeof sec === 'number' && sec > 0 ? Math.round(sec * 1000) : fallbackMs;
}

async function isDir(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  if (!(await isDir(tasksDir))) {
    throw new Error(`DeepSWE tasks not found at ${tasksDir}. Clone it there or pass --src <dir>.`);
  }

  // Fresh output each run (the generator fully owns evals/).
  await rm(casesOutDir, { recursive: true, force: true });
  await mkdir(casesOutDir, { recursive: true });

  const entries = await readdir(tasksDir);
  let ported = 0;
  const skipped: string[] = [];

  for (const name of entries.sort()) {
    const taskDir = join(tasksDir, name);
    const tomlPath = join(taskDir, 'task.toml');
    if (!(await isDir(taskDir))) continue;
    try {
      await stat(tomlPath);
    } catch {
      continue; // not a task dir (e.g. manifest.json)
    }

    const toml = parseToml(await readFile(tomlPath, 'utf8')) as TaskToml;
    const id = toml.metadata?.task_id ?? name;
    const upstreamImage = toml.environment?.docker_image;
    if (!upstreamImage) {
      skipped.push(`${id}: no environment.docker_image`);
      continue;
    }
    // Use the locally built *native* image (FROM the multi-arch mars-base) as
    // the managed-build base, instead of the upstream amd64-only prebuilt image
    // (which would run under emulation). Build it first with:
    //   bun scripts/build-images.ts --only <id>
    const image = imageTag(id);

    const instruction = await readFile(join(taskDir, 'instruction.md'), 'utf8');
    const caseDir = join(casesOutDir, id);
    await mkdir(caseDir, { recursive: true });
    await cp(join(taskDir, 'tests', 'test.sh'), join(caseDir, 'test.sh'));
    await cp(join(taskDir, 'tests', 'test.patch'), join(caseDir, 'test.patch'));
    await writeFile(join(caseDir, 'run.sh'), RUN_WRAPPER);

    const testCase = {
      id,
      suite: 'deep-swe',
      description: toml.metadata?.display_title ?? id,
      image,
      workspace: { seedFromImage: true, seedPath: '/app', containerPath: '/app' },
      timeoutMs: secToMs(toml.agent?.timeout_sec, 1_800_000),
      prompt: instruction,
      assert: [],
      verifier: {
        command: 'bash',
        args: ['/tests/run.sh'],
        cwd: '/app',
        assetsDir: `evals/${id}`,
        assetsTarget: '/tests',
        rewardFile: '.harness-evals-reward.txt',
        rewardFormat: 'text',
        timeoutMs: secToMs(toml.verifier?.timeout_sec, 1_800_000),
        // DeepSWE tasks are air-gapped at grading (allow_internet=false on all
        // current tasks); keep the verifier deterministic with no network.
        network: { mode: toml.environment?.allow_internet ? 'default' : 'none' },
      },
    };

    const lang = toml.metadata?.language ?? 'unknown';
    const base = toml.metadata?.base_commit_hash ?? 'unknown';
    const yaml = `# Generated by scripts/port-deep-swe.ts from DeepSWE task "${id}".\n` +
      `# language: ${lang}  base_commit: ${base}  source: deep-swe. Do not edit by hand.\n` +
      `# image: ${image} (native, built from environment/Dockerfile via scripts/build-images.ts).\n` +
      `# upstream image (amd64-only, emulated): ${upstreamImage}\n` +
      stringifyYaml(testCase, { lineWidth: 0 });
    await writeFile(join(caseDir, `${id}.yaml`), yaml);
    ported += 1;
  }

  console.log(`Ported ${ported} DeepSWE tasks -> ${casesOutDir}/<id>/`);
  if (skipped.length) console.log(`Skipped ${skipped.length}:\n  ${skipped.join('\n  ')}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
