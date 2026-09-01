// Multi-repo variant. Grades the agent's answer at `.harness-answer.txt`.
// Reward 1.0 when both real callers are named with their sub-repository prefix
// and no false positive appears.
import { readFileSync, writeFileSync } from 'node:fs';

const answerPath = '/home/dev/Projects/FelanAI/.harness-answer.txt';
const rewardPath = '/home/dev/Projects/FelanAI/.harness-evals-reward.txt';

// Both real callers of ProjectService.gitRoot in the multi-repo fixture:
//   felan/packages/ext-codebase-memory/src/services.ts:34
//   felan/packages/ext-codebase-memory/src/services.ts:81
// felan-platform contains no ProjectService and no gitRoot reference at all.
const mustInclude = [
  /felan\/packages\/ext-codebase-memory\/src\/services\.ts:34\b/,
  /felan\/packages\/ext-codebase-memory\/src\/services\.ts:81\b/,
];
// The unrelated local `gitRoot` in the TUI must NOT appear. Matched without the
// sub-repo prefix so a bare repo-relative false positive is still caught.
const mustExclude = [/apps\/tui\/src\/memory\/project\.ts/];

let reward = 0;
try {
  const answer = readFileSync(answerPath, 'utf8');
  if (!answer.trim()) {
    console.error(`Empty answer file at ${answerPath}`);
  } else {
    const missing = mustInclude.filter((regex) => !regex.test(answer));
    const forbidden = mustExclude.filter((regex) => regex.test(answer));
    if (missing.length === 0 && forbidden.length === 0) {
      reward = 1;
    } else {
      if (missing.length > 0) console.error(`Missing: ${missing.map(String).join(', ')}`);
      if (forbidden.length > 0) console.error(`Forbidden matches: ${forbidden.map(String).join(', ')}`);
      console.error(`Answer was:\n${answer}`);
    }
  }
} catch (error) {
  console.error(`Could not read ${answerPath}: ${error instanceof Error ? error.message : String(error)}`);
}

writeFileSync(rewardPath, `${reward}\n`);
console.log(String(reward));
if (reward === 0) process.exitCode = 1;
