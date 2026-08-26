import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

export const OUTPUT_STYLE_ARMS = [
  'felan-output-style-disabled',
  'felan-output-style-concise',
  'felan-output-style-explanatory',
] as const;

export const FIXED_PROMPT_CHARACTERS: Record<string, number> = {
  'felan-output-style-disabled': 0,
  'felan-output-style-concise': 280,
  'felan-output-style-explanatory': 308,
};

const OUTPUT_STYLE_CASES = new Set([
  'output-style-support',
  'output-style-planning',
  'output-style-review',
  'output-style-coding-summary',
  'output-style-blocker',
]);

export interface AnalysisRow {
  caseId: string;
  suite?: string;
  agentName: string;
  runId: string;
  attemptNumber?: number;
  status: string;
  pass: boolean;
  durationMs?: number;
  finalCharacters: number;
  finalTokens: number;
  finalTokenSource: 'reported' | 'estimated';
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  totalCost?: number;
  requests?: number;
  fixedPromptCharacters: number;
  retainedFacts: number;
  requiredFacts: number;
  unsupportedClaims: number;
  verifierReward?: number;
  error?: string;
  finalOutput: string;
}

export interface BlindedReviewRow {
  blindId: string;
  caseId: string;
  arm: string;
  runId: string;
  finalOutput: string;
}

export interface ReviewResponse {
  blindId: string;
  clarity?: number;
  preferred?: boolean;
  omission?: boolean;
  notes?: string;
}

export interface AnalysisReport {
  generatedAt: string;
  artifactRoot: string;
  batch?: string;
  expectedArms: readonly string[];
  rows: AnalysisRow[];
  parity: { completeCases: string[]; incompleteCases: string[]; duplicateArms: string[] };
  findings: {
    conciseBeneficialCases: string[];
    conciseContextRiskCases: string[];
    explanatoryBeneficialCases: string[];
    missingCostCases: string[];
  };
  reviews: ReviewResponse[];
}

interface RecordValue {
  [key: string]: unknown;
}

export async function analyzeOutputStyle(artifactRoot: string, reviews: ReviewResponse[] = [], batch?: string): Promise<AnalysisReport> {
  const candidates: Array<{ runDir: string; runId: string; summary: RecordValue }> = [];
  for (const runId of await directoryNames(artifactRoot)) {
    const runDir = join(artifactRoot, runId);
    const summary = await readJson(join(runDir, 'summary.json'));
    if (!summary || !OUTPUT_STYLE_CASES.has(string(summary.caseId))) continue;
    candidates.push({ runDir, runId, summary });
  }

  const availableBatches = candidates.map((candidate) => string(candidate.summary.batchId)).filter(Boolean).sort();
  const selectedBatch = batch === 'latest' ? availableBatches.at(-1) : batch;
  const selected = selectedBatch
    ? candidates.filter((candidate) => string(candidate.summary.batchId) === selectedBatch)
    : candidates;
  const rows = await Promise.all(selected.map((candidate) => analyzeRun(candidate.runDir, candidate.runId, candidate.summary)));

  rows.sort((left, right) => `${left.caseId}:${left.agentName}:${left.runId}`.localeCompare(`${right.caseId}:${right.agentName}:${right.runId}`));
  const parity = buildParity(rows);
  return {
    generatedAt: new Date().toISOString(),
    artifactRoot: resolve(artifactRoot),
    batch: selectedBatch,
    expectedArms: OUTPUT_STYLE_ARMS,
    rows,
    parity,
    findings: buildFindings(rows),
    reviews,
  };
}

export async function writeAnalysisReport(report: AnalysisReport, outputPath: string, format: 'json' | 'csv' | 'markdown' = 'json'): Promise<void> {
  const content = format === 'csv' ? renderCsv(report.rows) : format === 'markdown' ? renderMarkdown(report) : `${JSON.stringify(report, null, 2)}\n`;
  await writeFile(outputPath, content);
}

export async function writeReviewTemplate(report: AnalysisReport, templatePath: string, keyPath: string): Promise<void> {
  const key: Record<string, { caseId: string; agentName: string; runId: string }> = {};
  const rows: BlindedReviewRow[] = [];
  report.rows.forEach((row, index) => {
    const blindId = `response-${String(index + 1).padStart(4, '0')}`;
    key[blindId] = { caseId: row.caseId, agentName: row.agentName, runId: row.runId };
    rows.push({ blindId, caseId: row.caseId, arm: 'blinded', runId: row.runId, finalOutput: row.finalOutput });
  });
  const csv = [
    'blindId,caseId,arm,finalOutput,clarity_1_to_5,preferred,omission,notes',
    ...rows.map((row) => [row.blindId, row.caseId, row.arm, row.finalOutput, '', '', '', ''].map(csvCell).join(',')),
  ].join('\n') + '\n';
  await writeFile(templatePath, csv);
  await writeFile(keyPath, `${JSON.stringify(key, null, 2)}\n`);
}

export function parseReviewCsv(csv: string): ReviewResponse[] {
  const lines = parseCsv(csv).slice(1);
  return lines.flatMap((cells) => {
    const blindId = cells[0]?.trim();
    if (!blindId) return [];
    const clarity = numberOrUndefined(cells[4]);
    const preferred = booleanOrUndefined(cells[5]);
    const omission = booleanOrUndefined(cells[6]);
    return [{ blindId, clarity, preferred, omission, notes: cells[7] || undefined }];
  });
}

async function analyzeRun(runDir: string, runId: string, summary: RecordValue): Promise<AnalysisRow> {
  const step = record(Array.isArray(summary.steps) ? summary.steps[summary.steps.length - 1] : undefined);
  const events = await readJson(join(runDir, 'steps', step ? string(step.id) || 'run' : 'run', 'events-summary.json'))
    ?? record(summary.events)
    ?? {};
  const finalOutput = string(events.finalOutput) || string(summary.output);
  const cost = record(summary.cost);
  const rollup = record(cost?.rollup);
  const usage = firstUsage(cost);
  const finalUsage = await readFinalUsage(runDir, step ? string(step.id) || 'run' : 'run');
  const assertions = await readAssertions(runDir, step ? string(step.id) || 'run' : 'run');
  const requiredFacts = assertions.filter((value) => /retained|specific|focused|no-files/i.test(string(record(value)?.id))).length;
  const retainedFacts = assertions.filter((value) => {
    const assertion = record(value);
    return /retained|specific|focused|no-files/i.test(string(assertion?.id)) && assertion?.pass === true;
  }).length;
  const unsupportedChecks = assertions.filter((value) => /unsupported/i.test(string(record(value)?.id)));
  const unsupportedClaims = unsupportedChecks.filter((value) => record(value)?.pass !== true).length;
  const verifier = record(summary.verifier);
  const reward = record(verifier?.reward);
  const reportedFinalTokens = finalUsage?.outputTokens;
  return {
    caseId: string(summary.caseId),
    suite: optionalString(summary.suite),
    agentName: string(summary.agentName),
    runId,
    attemptNumber: numberOrUndefined(summary.attemptNumber),
    status: string(summary.status),
    pass: summary.pass === true,
    durationMs: numberOrUndefined(summary.durationMs),
    finalCharacters: finalOutput.length,
    finalTokens: reportedFinalTokens ?? Math.ceil(finalOutput.length / 4),
    finalTokenSource: reportedFinalTokens === undefined ? 'estimated' : 'reported',
    inputTokens: numberOrUndefined(rollup?.inputTokens ?? usage?.inputTokens),
    outputTokens: numberOrUndefined(rollup?.outputTokens ?? usage?.outputTokens),
    totalTokens: numberOrUndefined(rollup?.totalTokens ?? usage?.totalTokens),
    totalCost: numberOrUndefined(cost?.totalCost ?? usage?.totalCost),
    requests: numberOrUndefined(rollup?.requests ?? usage?.requests),
    fixedPromptCharacters: FIXED_PROMPT_CHARACTERS[string(summary.agentName)] ?? 0,
    retainedFacts,
    requiredFacts,
    unsupportedClaims,
    verifierReward: numberOrUndefined(reward?.primary),
    error: optionalString(summary.error),
    finalOutput,
  };
}

async function readAssertions(runDir: string, stepId: string): Promise<unknown[]> {
  const payload = parseAnyJson(await readFile(join(runDir, 'steps', stepId, 'assertions.json'), 'utf8').catch(() => ''));
  if (Array.isArray(payload)) return payload;
  const recordPayload = record(payload);
  if (Array.isArray(recordPayload?.results)) return recordPayload.results;
  if (Array.isArray(recordPayload?.assertions)) return recordPayload.assertions;
  return [];
}

async function readFinalUsage(runDir: string, stepId: string): Promise<{ outputTokens?: number } | undefined> {
  const text = await readFile(join(runDir, 'steps', stepId, 'stdout.log'), 'utf8').catch(() => '');
  let latest: { outputTokens?: number } | undefined;
  for (const line of text.split(/\r?\n/)) {
    const event = parseJson(line);
    const message = record(event?.message);
    const usage = record(message?.usage);
    if (message?.role !== 'assistant' || !usage) continue;
    const output = numberOrUndefined(usage.output);
    if (output !== undefined) latest = { outputTokens: output };
  }
  return latest;
}

function buildParity(rows: AnalysisRow[]): AnalysisReport['parity'] {
  const byCase = new Map<string, AnalysisRow[]>();
  for (const row of rows) byCase.set(row.caseId, [...(byCase.get(row.caseId) ?? []), row]);
  const completeCases: string[] = [];
  const incompleteCases: string[] = [];
  const duplicateArms: string[] = [];
  for (const [caseId, caseRows] of byCase) {
    const arms = caseRows.map((row) => row.agentName);
    const duplicates = OUTPUT_STYLE_ARMS.filter((arm) => arms.filter((value) => value === arm).length > 1);
    if (duplicates.length > 0) duplicateArms.push(`${caseId}: ${duplicates.join(', ')}`);
    if (OUTPUT_STYLE_ARMS.every((arm) => arms.includes(arm))) completeCases.push(caseId);
    else incompleteCases.push(caseId);
  }
  return { completeCases, incompleteCases, duplicateArms };
}

function buildFindings(rows: AnalysisRow[]): AnalysisReport['findings'] {
  const byCase = groupByCase(rows);
  const conciseBeneficialCases: string[] = [];
  const conciseContextRiskCases: string[] = [];
  const explanatoryBeneficialCases: string[] = [];
  const missingCostCases: string[] = [];
  for (const [caseId, caseRows] of byCase) {
    const concise = caseRows.find((row) => row.agentName === 'felan-output-style-concise');
    const disabled = caseRows.find((row) => row.agentName === 'felan-output-style-disabled');
    const explanatory = caseRows.find((row) => row.agentName === 'felan-output-style-explanatory');
    if (caseRows.some((row) => row.totalCost === undefined || row.totalTokens === undefined)) missingCostCases.push(caseId);
    if (concise && disabled && concise.pass && concise.finalCharacters < disabled.finalCharacters) conciseBeneficialCases.push(caseId);
    if (concise && concise.requiredFacts > 0 && concise.retainedFacts < concise.requiredFacts) conciseContextRiskCases.push(caseId);
    if (explanatory && disabled && explanatory.pass && explanatory.finalCharacters < disabled.finalCharacters) explanatoryBeneficialCases.push(caseId);
  }
  return { conciseBeneficialCases, conciseContextRiskCases, explanatoryBeneficialCases, missingCostCases };
}

function renderCsv(rows: AnalysisRow[]): string {
  const columns = ['caseId', 'suite', 'agentName', 'runId', 'attemptNumber', 'status', 'pass', 'durationMs', 'finalCharacters', 'finalTokens', 'finalTokenSource', 'inputTokens', 'outputTokens', 'totalTokens', 'totalCost', 'requests', 'fixedPromptCharacters', 'retainedFacts', 'requiredFacts', 'unsupportedClaims', 'verifierReward', 'error'];
  return [columns.join(','), ...rows.map((row) => columns.map((column) => csvCell(row[column as keyof AnalysisRow])).join(',')), ''].join('\n');
}

function renderMarkdown(report: AnalysisReport): string {
  const lines = [
    '# BUG-398 output-style analysis',
    '',
    `Generated: ${report.generatedAt}`,
    `Cases with all arms: ${report.parity.completeCases.join(', ') || 'none'}`,
    `Cases missing arms: ${report.parity.incompleteCases.join(', ') || 'none'}`,
    '',
    '| Case | Arm | Status | Final chars | Final tokens | Total tokens | Cost | Facts | Unsupported |',
    '| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...report.rows.map((row) => `| ${row.caseId} | ${row.agentName} | ${row.status} | ${row.finalCharacters} | ${row.finalTokens} (${row.finalTokenSource}) | ${row.totalTokens ?? 'n/a'} | ${row.totalCost ?? 'n/a'} | ${row.retainedFacts}/${row.requiredFacts} | ${row.unsupportedClaims} |`),
    '',
    `Concise beneficial cases: ${report.findings.conciseBeneficialCases.join(', ') || 'none observed'}`,
    `Concise context-risk cases: ${report.findings.conciseContextRiskCases.join(', ') || 'none observed'}`,
    `Explanatory beneficial cases: ${report.findings.explanatoryBeneficialCases.join(', ') || 'none observed'}`,
    `Missing cost cases: ${report.findings.missingCostCases.join(', ') || 'none'}`,
    '',
    'Final-response metrics are separate from total-run usage. Fixed output-style prompt additions are 0, 280, and 308 characters for disabled, concise, and explanatory respectively.',
  ];
  return `${lines.join('\n')}\n`;
}

function groupByCase(rows: AnalysisRow[]): Map<string, AnalysisRow[]> {
  const grouped = new Map<string, AnalysisRow[]>();
  for (const row of rows) grouped.set(row.caseId, [...(grouped.get(row.caseId) ?? []), row]);
  return grouped;
}

async function directoryNames(root: string): Promise<string[]> {
  return (await readdir(root, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
}

async function readJson(path: string): Promise<RecordValue | undefined> {
  return parseJson(await readFile(path, 'utf8').catch(() => ''));
}

function parseJson(value: string): RecordValue | undefined {
  const parsed = parseAnyJson(value);
  return record(parsed);
}

function parseAnyJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

function firstUsage(cost: RecordValue | undefined): RecordValue | undefined {
  const usage = cost?.usage;
  return Array.isArray(usage) ? record(usage[0]) : undefined;
}

function record(value: unknown): RecordValue | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : undefined;
}

function string(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function optionalString(value: unknown): string | undefined {
  const result = string(value);
  return result || undefined;
}

function numberOrUndefined(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

function booleanOrUndefined(value: string | undefined): boolean | undefined {
  if (value === 'true' || value === 'yes' || value === '1') return true;
  if (value === 'false' || value === 'no' || value === '0') return false;
  return undefined;
}

function csvCell(value: unknown): string {
  const text = value === undefined || value === null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function parseCsv(value: string): string[][] {
  const rows: string[][] = [[]];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char === '"') {
      if (quoted && value[index + 1] === '"') { cell += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === ',' && !quoted) { rows.at(-1)!.push(cell); cell = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && value[index + 1] === '\n') index += 1;
      rows.at(-1)!.push(cell); cell = '';
      if (index < value.length - 1) rows.push([]);
    } else cell += char;
  }
  rows.at(-1)!.push(cell);
  return rows.filter((row) => row.length > 1 || row[0] !== '');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const artifactRoot = argument(args, '--artifact-root') ?? '.harness-evals/runs';
  const outputPath = argument(args, '--output');
  const format = (argument(args, '--format') ?? 'json') as 'json' | 'csv' | 'markdown';
  const reviewsPath = argument(args, '--reviews');
  const reviews = reviewsPath ? parseReviewCsv(await readFile(reviewsPath, 'utf8')) : [];
  const report = await analyzeOutputStyle(artifactRoot, reviews, argument(args, '--batch'));
  if (outputPath) await writeAnalysisReport(report, outputPath, format);
  const templatePath = argument(args, '--review-template');
  const keyPath = argument(args, '--review-key') ?? (templatePath ? `${templatePath}.key.json` : undefined);
  if (templatePath && keyPath) await writeReviewTemplate(report, templatePath, keyPath);
  if (!outputPath) process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  if (report.parity.incompleteCases.length > 0 || report.parity.duplicateArms.length > 0) process.exitCode = 2;
}

function argument(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

if (import.meta.main) await main();
