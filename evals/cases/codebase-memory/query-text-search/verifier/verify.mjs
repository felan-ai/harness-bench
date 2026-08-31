// Grades the agent's answer at `.harness-answer.txt`.
// Reward 1.0 when both files that reference the SHA constant appear.
import { readFileSync, writeFileSync } from 'node:fs';

const answerPath = '/workspace/.harness-answer.txt';
const rewardPath = '/workspace/.harness-evals-reward.txt';

// At commit 7ae8f94, exactly two files reference this SHA literal:
//   packages/ext-codebase-memory/src/installer.ts
//   packages/ext-codebase-memory/test/package.test.ts
const mustInclude = [
  /packages\/ext-codebase-memory\/src\/installer\.ts/,
  /packages\/ext-codebase-memory\/test\/package\.test\.ts/,
];

let reward = 0;
try {
  const answer = readFileSync(answerPath, 'utf8');
  if (!answer.trim()) {
    console.error(`Empty answer file at ${answerPath}`);
  } else {
    const missing = mustInclude.filter((regex) => !regex.test(answer));
    if (missing.length === 0) {
      reward = 1;
    } else {
      console.error(`Missing: ${missing.map(String).join(', ')}`);
      console.error(`Answer was:\n${answer}`);
    }
  }
} catch (error) {
  console.error(`Could not read ${answerPath}: ${error instanceof Error ? error.message : String(error)}`);
}

writeFileSync(rewardPath, `${reward}\n`);
console.log(String(reward));
if (reward === 0) process.exitCode = 1;
