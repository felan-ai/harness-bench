#!/usr/bin/env bun

import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const EXPECTED = {
  caseId: 'storzy-authenticated-checkout',
  controls: ['felan-vercel-gpt56-sol-high-no-prewalk', 'felan-vercel-gpt56-luna-medium-no-prewalk'],
  controlModels: {
    'felan-vercel-gpt56-sol-high-no-prewalk': 'openai/gpt-5.6-sol',
    'felan-vercel-gpt56-luna-medium-no-prewalk': 'openai/gpt-5.6-luna',
  },
  routed: 'felan-vercel-gpt56-sol-high-prewalk-luna-medium',
  provider: 'vercel-ai-gateway',
  plannerModel: 'openai/gpt-5.6-sol',
  targetModel: 'openai/gpt-5.6-luna',
} as const;

interface RunRecord {
  runId: string;
  runDir: string;
  batchId: string;
  batchStartedAt?: string;
  caseId: string;
  agentName: string;
  attemptNumber: number;
  attempts: number;
  status: string;
  pass: boolean;
  durationMs?: number;
  cost?: {
    totalCost?: number;
    inputTokens?: number;
    outputTokens?: number;
    cachedInputTokens?: number;
    totalTokens?: number;
    requests?: number;
    usage?: Array<{ provider?: string; model?: string; totalCost?: number; inputTokens?: number; outputTokens?: number; cachedInputTokens?: number; totalTokens?: number; requests?: number }>;
  };
  models: string[];
  providers: string[];
  enteredPrewalk: boolean;
}

function number(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function string(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

async function json(path: string): Promise<Record<string, unknown> | undefined> {
  try { return JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>; } catch { return undefined; }
}

async function recordsEvidence(path: string): Promise<{ models: string[]; providers: string[]; enteredPrewalk: boolean }> {
  let lines = '';
  try { lines = await readFile(path, 'utf8'); } catch { return { models: [], providers: [], enteredPrewalk: false }; }
  const models = new Set<string>();
  const providers = new Set<string>();
  let enteredPrewalk = false;
  for (const line of lines.split(/\r?\n/)) {
    try {
      const event = JSON.parse(line) as Record<string, unknown>;
      const toolName = string(event.toolName);
      if (toolName === 'enter_prewalk' && event.isError !== true) enteredPrewalk = true;
      const message = record(event.message);
      const model = string(message?.model);
      const provider = string(message?.provider);
      if (model) models.add(model);
      if (provider) providers.add(provider);

      const payload = record(event.payload);
      const toolCalls = Array.isArray(payload?.toolCalls) ? payload.toolCalls : [];
      if (toolCalls.some((call) => {
        const toolCall = record(call);
        return string(toolCall?.name) === 'enter_prewalk' && toolCall?.isError !== true;
      })) enteredPrewalk = true;

      const cost = record(payload?.cost);
      const byModel = record(cost?.byModel);
      const byProvider = record(cost?.byProvider);
      for (const observedModel of Object.keys(byModel ?? {})) models.add(observedModel);
      for (const observedProvider of Object.keys(byProvider ?? {})) providers.add(observedProvider);
      const usage = Array.isArray(cost?.usage) ? cost.usage : [];
      for (const item of usage) {
        const entry = record(item);
        const observedModel = string(entry?.model);
        const observedProvider = string(entry?.provider);
        if (observedModel) models.add(observedModel);
        if (observedProvider) providers.add(observedProvider);
      }
    } catch { /* Ignore non-JSON log lines. */ }
  }
  return { models: [...models].sort(), providers: [...providers].sort(), enteredPrewalk };
}

async function scan(artifactRoot: string): Promise<RunRecord[]> {
  const names = await readdir(artifactRoot, { withFileTypes: true });
  const runs: RunRecord[] = [];
  for (const entry of names.filter((candidate) => candidate.isDirectory())) {
    const runDir = join(artifactRoot, entry.name);
    const summary = await json(join(runDir, 'summary.json'));
    const started = await json(join(runDir, 'run-started.json'));
    if (!summary || summary.caseId !== EXPECTED.caseId) continue;
    const batch = (started?.batch ?? {}) as Record<string, unknown>;
    const startedCost = (summary.cost ?? {}) as Record<string, unknown>;
    const rollup = (startedCost.rollup ?? {}) as Record<string, unknown>;
    const evidence = await recordsEvidence(join(runDir, 'records.jsonl'));
    const byModel = (startedCost.byModel ?? {}) as Record<string, unknown>;
    const byProvider = (startedCost.byProvider ?? {}) as Record<string, unknown>;
    const models = [...new Set([...evidence.models, ...Object.keys(byModel)])].sort();
    const providers = [...new Set([...evidence.providers, ...Object.keys(byProvider)])].sort();
    runs.push({
      runId: entry.name,
      runDir,
      batchId: string(summary.batchId) ?? string(batch.batchId) ?? 'unknown',
      batchStartedAt: string(batch.startedAt),
      caseId: EXPECTED.caseId,
      agentName: string(summary.agentName) ?? 'unknown',
      attemptNumber: number(summary.attemptNumber) ?? 1,
      attempts: number(summary.attempts) ?? 1,
      status: string(summary.status) ?? 'incomplete',
      pass: summary.pass === true,
      durationMs: number(summary.durationMs),
      cost: {
        totalCost: number(startedCost.totalCost),
        inputTokens: number(rollup.inputTokens),
        outputTokens: number(rollup.outputTokens),
        cachedInputTokens: number(rollup.cachedInputTokens),
        totalTokens: number(rollup.totalTokens),
        requests: number(rollup.requests),
        usage: Object.entries(byModel).map(([model, value]) => {
          const entry = value as Record<string, unknown>;
          return { model, totalCost: number(entry.totalCost), inputTokens: number(entry.inputTokens), outputTokens: number(entry.outputTokens), cachedInputTokens: number(entry.cachedInputTokens), totalTokens: number(entry.totalTokens), requests: number(entry.requests) };
        }),
      },
      models,
      providers,
      enteredPrewalk: evidence.enteredPrewalk,
    });
  }
  return runs.sort((left, right) => left.runId.localeCompare(right.runId));
}

function latestBatch(runs: RunRecord[]): string | undefined {
  return [...new Set(runs.map((run) => run.batchId))].sort((left, right) => {
    const leftTime = runs.find((run) => run.batchId === left)?.batchStartedAt ?? left;
    const rightTime = runs.find((run) => run.batchId === right)?.batchStartedAt ?? right;
    return rightTime.localeCompare(leftTime);
  })[0];
}

function sum(values: Array<number | undefined>): number | undefined {
  const present = values.filter((value): value is number => value !== undefined);
  return present.length > 0 ? present.reduce((total, value) => total + value, 0) : undefined;
}

function fixed(value: number | undefined, digits = 4): string {
  return value === undefined ? 'n/a' : value.toFixed(digits);
}

function printReport(runs: RunRecord[], batch: string): void {
  const grouped = new Map<string, RunRecord[]>();
  for (const run of runs) grouped.set(run.agentName, [...(grouped.get(run.agentName) ?? []), run]);
  console.log(`Prewalk benchmark · batch ${batch}`);
  console.log('arm\tattempts\tsolved\tsolve rate\tavg ms\ttotal cost\tinput\toutput\tcache\ttotal tokens\tproviders\tmodels');
  for (const agent of [...EXPECTED.controls, EXPECTED.routed]) {
    const arm = grouped.get(agent) ?? [];
    const solved = arm.filter((run) => run.pass).length;
    console.log([
      agent,
      arm.length,
      solved,
      arm.length ? `${((solved / arm.length) * 100).toFixed(1)}%` : 'n/a',
      fixed(arm.length ? sum(arm.map((run) => run.durationMs))! / arm.length : undefined, 0),
      fixed(sum(arm.map((run) => run.cost?.totalCost))),
      fixed(sum(arm.map((run) => run.cost?.inputTokens)), 0),
      fixed(sum(arm.map((run) => run.cost?.outputTokens)), 0),
      fixed(sum(arm.map((run) => run.cost?.cachedInputTokens)), 0),
      fixed(sum(arm.map((run) => run.cost?.totalTokens)), 0),
      [...new Set(arm.flatMap((run) => run.providers))].join(',') || 'n/a',
      [...new Set(arm.flatMap((run) => run.models))].join(',') || 'n/a',
    ].join('\t'));
  }
}

function validate(runs: RunRecord[]): string[] {
  const errors: string[] = [];
  for (const run of runs) {
    const controlModel = EXPECTED.controlModels[run.agentName as keyof typeof EXPECTED.controlModels];
    const expectedArm = controlModel !== undefined || run.agentName === EXPECTED.routed;
    if (expectedArm && (run.providers.length !== 1 || run.providers[0] !== EXPECTED.provider)) {
      errors.push(`${run.agentName}/${run.attemptNumber}: expected only provider ${EXPECTED.provider}; observed ${run.providers.join(',') || 'none'}`);
    }
    if (controlModel !== undefined) {
      if (run.enteredPrewalk) errors.push(`${run.agentName}/${run.attemptNumber}: control entered Prewalk`);
      if (run.models.length !== 1 || run.models[0] !== controlModel) {
        errors.push(`${run.agentName}/${run.attemptNumber}: expected only control model ${controlModel}; observed ${run.models.join(',') || 'none'}`);
      }
    }
    if (run.agentName === EXPECTED.routed) {
      if (!run.enteredPrewalk) errors.push(`${run.agentName}/${run.attemptNumber}: missing enter_prewalk evidence`);
      if (!run.models.includes(EXPECTED.plannerModel)) errors.push(`${run.agentName}/${run.attemptNumber}: missing planner model ${EXPECTED.plannerModel}`);
      if (!run.models.includes(EXPECTED.targetModel)) errors.push(`${run.agentName}/${run.attemptNumber}: missing target model ${EXPECTED.targetModel}`);
      const unexpectedModels = run.models.filter((model) => model !== EXPECTED.plannerModel && model !== EXPECTED.targetModel);
      if (unexpectedModels.length > 0) {
        errors.push(`${run.agentName}/${run.attemptNumber}: unexpected routed models ${unexpectedModels.join(',')}`);
      }
    }
  }
  for (const expected of [...EXPECTED.controls, EXPECTED.routed]) {
    if (!runs.some((run) => run.agentName === expected)) errors.push(`missing arm ${expected}`);
  }
  return errors;
}

const args = process.argv.slice(2);
const rootArg = args.find((arg) => arg.startsWith('--artifact-root='))?.slice('--artifact-root='.length);
const batchArg = args.find((arg) => arg.startsWith('--batch='))?.slice('--batch='.length) ?? 'latest';
const artifactRoot = resolve(rootArg ?? '.harness-evals/runs');
const allRuns = await scan(artifactRoot);
if (allRuns.length === 0) {
  console.error(`No ${EXPECTED.caseId} runs found under ${artifactRoot}`);
  process.exit(1);
}
const batch = batchArg === 'all' ? undefined : batchArg === 'latest' ? latestBatch(allRuns) : batchArg;
const runs = batch ? allRuns.filter((run) => run.batchId === batch) : allRuns;
if (runs.length === 0) {
  console.error(`No runs found for batch ${batchArg}`);
  process.exit(1);
}
printReport(runs, batch ?? 'all');
const errors = validate(runs);
if (errors.length > 0) {
  console.error('\nRouting validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('\nRouting validation passed.');
