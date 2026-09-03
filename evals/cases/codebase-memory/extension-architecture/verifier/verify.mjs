import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const workspace = process.cwd();
const rewardPath = `${workspace}/.harness-evals-reward.txt`;
const reportPath = `${workspace}/EXTENSION-ARCHITECTURE.md`;
const pinnedCommit = 'e5867637569bd1c7ad08420b79ec4031a5733f57';

const MIN_WORDS = 150;
const MIN_CITATIONS = 8;
const CITATION_PATTERN = /\b(?:packages|apps)\/[A-Za-z0-9_.\-/]+\.(?:ts|tsx|md|json)\b/g;
const BREADTH_PATTERN = /\bpackages\/ext-[a-z0-9-]+\b/gi;
const MIN_BREADTH = 3;

let reward = 0;
let reason = '';

try {
  verifyWorkspaceBoundary();

  const text = await readFile(reportPath, 'utf8');
  const wordCount = text.trim().split(/\s+/u).filter(Boolean).length;
  if (wordCount < MIN_WORDS) {
    throw new Error(`report too short: ${wordCount} words (minimum ${MIN_WORDS})`);
  }

  const facts = JSON.parse(await readFile('/tests/facts.json', 'utf8'));
  let matched = 0;
  for (const fact of facts) {
    if (fact.patterns.length === 1 && fact.patterns[0] === '__BREADTH__') {
      const distinct = new Set((text.match(BREADTH_PATTERN) ?? []).map((s) => s.toLowerCase()));
      if (distinct.size >= MIN_BREADTH) matched += 1;
      continue;
    }
    const allMatch = fact.patterns.every((pattern) => new RegExp(pattern, 'iu').test(text));
    if (allMatch) matched += 1;
  }
  const coverage = matched / facts.length;

  const citations = new Set(text.match(CITATION_PATTERN) ?? []);
  const totalCited = citations.size;
  let precision = 0;
  if (totalCited >= MIN_CITATIONS) {
    let existing = 0;
    for (const citation of citations) {
      if (existsSync(path.join(workspace, citation))) existing += 1;
    }
    precision = existing / totalCited;
  }

  reward = Math.round(coverage * precision * 1000) / 1000;
  reason = `coverage=${matched}/${facts.length} precision=${totalCited >= MIN_CITATIONS ? `${Math.round(precision * totalCited)}/${totalCited}` : `below minimum (${totalCited}/${MIN_CITATIONS})`}`;
} catch (error) {
  reason = error instanceof Error ? error.message : String(error);
  reward = 0;
} finally {
  await writeFile(rewardPath, `${reward}\n`);
}

console.log(`${reward} (${reason})`);
if (reward <= 0) process.exitCode = 1;

function verifyWorkspaceBoundary() {
  const head = capture('git', ['rev-parse', 'HEAD']).trim();
  if (head !== pinnedCommit) {
    throw new Error('repository history changed');
  }
  if (capture('git', ['remote']).trim() !== '') {
    throw new Error('benchmark workspace unexpectedly has a Git remote');
  }

  const changedPaths = capture('git', [
    'status',
    '--porcelain=v1',
    '--untracked-files=all',
  ])
    .split(/\r?\n/u)
    .filter(Boolean)
    .flatMap((line) => line.slice(3).split(' -> '));

  const disallowed = changedPaths.filter((changedPath) => changedPath !== 'EXTENSION-ARCHITECTURE.md');
  if (disallowed.length > 0) {
    throw new Error(`changes outside EXTENSION-ARCHITECTURE.md: ${disallowed.join(', ')}`);
  }
  if (!changedPaths.includes('EXTENSION-ARCHITECTURE.md')) {
    throw new Error('EXTENSION-ARCHITECTURE.md was not created');
  }
}

function capture(command, args) {
  const result = spawnSync(command, args, {
    cwd: workspace,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    timeout: 30_000,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed:\n${result.stderr || result.stdout}`);
  }
  return result.stdout;
}
