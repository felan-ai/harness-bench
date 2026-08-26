import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'bun:test';
import { analyzeOutputStyle, parseReviewCsv, writeReviewTemplate } from './analyze-output-style.ts';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

test('analyzes final response separately from total run usage and detects parity', async () => {
  const root = await tempRoot();
  for (const [index, agentName] of [
    'felan-output-style-disabled',
    'felan-output-style-concise',
    'felan-output-style-explanatory',
  ].entries()) {
    const run = join(root, `output-style-support-${agentName}`);
    await mkdir(join(run, 'steps', 'run'), { recursive: true });
    await writeFile(join(run, 'summary.json'), JSON.stringify({
      caseId: 'output-style-support', agentName, runId: `run-${index}`, status: 'passed', pass: true,
      attemptNumber: 1, durationMs: 100 + index, steps: [{ id: 'run' }],
      assertions: [
        { id: 'outcome-retained', pass: true }, { id: 'verification-retained', pass: true },
        { id: 'caveat-retained', pass: true }, { id: 'blocker-retained', pass: true },
        { id: 'unsupported-test-claim', pass: true },
      ],
      cost: { totalCost: 0.2, rollup: { inputTokens: 1000, outputTokens: 50, totalTokens: 1050, requests: 2 } },
    }));
    await writeFile(join(run, 'steps', 'run', 'events-summary.json'), JSON.stringify({ finalOutput: `Outcome: response ${index}\nVerification: same task.\nCaveat: context.\nBlocker: none.` }));
    await writeFile(join(run, 'steps', 'run', 'assertions.json'), JSON.stringify({ results: [
      { id: 'outcome-retained', pass: true }, { id: 'verification-retained', pass: true },
      { id: 'caveat-retained', pass: true }, { id: 'blocker-retained', pass: true },
      { id: 'unsupported-test-claim', pass: true },
    ] }));
    await writeFile(join(run, 'steps', 'run', 'stdout.log'), JSON.stringify({ type: 'message_end', message: { role: 'assistant', usage: { output: 12 + index } } }) + '\n');
  }
  const report = await analyzeOutputStyle(root);
  expect(report.parity.completeCases).toEqual(['output-style-support']);
  const disabled = report.rows.find((row) => row.agentName === 'felan-output-style-disabled');
  const concise = report.rows.find((row) => row.agentName === 'felan-output-style-concise');
  expect(disabled?.finalTokenSource).toBe('reported');
  expect(disabled?.finalTokens).toBe(12);
  expect(disabled?.totalTokens).toBe(1050);
  expect(disabled?.fixedPromptCharacters).toBe(0);
  expect(concise?.fixedPromptCharacters).toBe(280);
  expect(disabled?.retainedFacts).toBe(4);
  expect(disabled?.requiredFacts).toBe(4);
});

test('round-trips blinded review CSV with quoted notes', async () => {
  const parsed = parseReviewCsv('blindId,caseId,arm,finalOutput,clarity_1_to_5,preferred,omission,notes\nresponse-0001,case,blinded,"hello, world",5,true,false,"clear, useful"\n');
  expect(parsed).toEqual([{ blindId: 'response-0001', clarity: 5, preferred: true, omission: false, notes: 'clear, useful' }]);
  const root = await tempRoot();
  const report = await analyzeOutputStyle(root);
  const template = join(root, 'review.csv');
  const key = join(root, 'review.key.json');
  await writeReviewTemplate({ ...report, rows: [{
    caseId: 'output-style-support', agentName: 'felan-output-style-concise', runId: 'r1', status: 'passed', pass: true,
    finalCharacters: 4, finalTokens: 1, finalTokenSource: 'estimated', fixedPromptCharacters: 280,
    retainedFacts: 4, requiredFacts: 4, unsupportedClaims: 0, finalOutput: 'a,b',
  }] }, template, key);
  expect((await readFile(template, 'utf8'))).toContain('"a,b"');
  expect(JSON.parse(await readFile(key, 'utf8'))['response-0001'].agentName).toBe('felan-output-style-concise');
});

async function tempRoot(): Promise<string> {
  const root = join(process.cwd(), '.tmp-output-style-test');
  roots.push(root);
  await rm(root, { recursive: true, force: true });
  await mkdir(root, { recursive: true });
  return root;
}
