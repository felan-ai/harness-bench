// Multi-repo variant. Grades the agent's answer at `.harness-answer.txt`.
// Reward 1.0 when the answer names ProjectService, CbmClient, and CacheManager.
// A superset (extra correct classes such as JobStore) is fine.
//
// Ground truth is identical to the single-repo case: felan-platform adds
// `runtime: AgentRuntime` distractors (apps/agent/src/agent-core.ts:137 and
// docs) but no class whose constructor takes one. The answer is class names
// only, so no path prefixing applies here.
import { readFileSync, writeFileSync } from 'node:fs';

const answerPath = '/home/dev/Projects/FelanAI/.harness-answer.txt';
const rewardPath = '/home/dev/Projects/FelanAI/.harness-evals-reward.txt';

const required = ['ProjectService', 'CbmClient', 'CacheManager'];

let reward = 0;
try {
  const answer = readFileSync(answerPath, 'utf8');
  if (!answer.trim()) {
    console.error(`Empty answer file at ${answerPath}`);
  } else {
    const missing = required.filter((name) => !new RegExp(`\\b${name}\\b`).test(answer));
    if (missing.length === 0) {
      reward = 1;
    } else {
      console.error(`Missing required class names: ${missing.join(', ')}`);
      console.error(`Answer was:\n${answer}`);
    }
  }
} catch (error) {
  console.error(`Could not read ${answerPath}: ${error instanceof Error ? error.message : String(error)}`);
}

writeFileSync(rewardPath, `${reward}\n`);
console.log(String(reward));
if (reward === 0) process.exitCode = 1;
