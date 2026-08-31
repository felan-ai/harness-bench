// Grades the agent's answer at `.harness-answer.txt`.
// Reward 1.0 when the answer names the ProjectService definition file.
import { readFileSync, writeFileSync } from 'node:fs';

const answerPath = '/workspace/.harness-answer.txt';
const rewardPath = '/workspace/.harness-evals-reward.txt';

const expectedFile = /packages\/ext-codebase-memory\/src\/services\.ts/;
// The class is defined at line 8 in commit 7ae8f94. Accept 7-9 to allow
// off-by-one interpretations (the class keyword vs. first member line).
const expectedLine = /:[7-9](?:\D|$)/;

let reward = 0;
try {
  const answer = readFileSync(answerPath, 'utf8').trim();
  if (!answer) {
    console.error(`Empty answer file at ${answerPath}`);
  } else if (!expectedFile.test(answer)) {
    console.error(`Answer does not name packages/ext-codebase-memory/src/services.ts`);
    console.error(`Answer was: ${answer}`);
  } else if (!expectedLine.test(answer)) {
    console.error(`Answer does not name a line number in 7-9`);
    console.error(`Answer was: ${answer}`);
  } else {
    reward = 1;
  }
} catch (error) {
  console.error(`Could not read ${answerPath}: ${error instanceof Error ? error.message : String(error)}`);
}

writeFileSync(rewardPath, `${reward}\n`);
console.log(String(reward));
if (reward === 0) process.exitCode = 1;
