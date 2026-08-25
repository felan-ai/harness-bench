import { readFile, writeFile } from 'node:fs/promises';

const target = await readFile('/workspace/target.txt', 'utf8').catch(() => '');
const pass = target === 'FELAN_SMOKE_PASS' || target === 'FELAN_SMOKE_PASS\n';
await writeFile('/workspace/.harness-evals-reward.txt', pass ? '1\n' : '0\n');
console.log(pass ? '1' : '0');
process.exitCode = pass ? 0 : 1;
