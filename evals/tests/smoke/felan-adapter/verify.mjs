import { join } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';

const workspace = process.cwd();
const target = await readFile(join(workspace, 'target.txt'), 'utf8').catch(() => '');
const pass = target === 'FELAN_SMOKE_PASS' || target === 'FELAN_SMOKE_PASS\n';
await writeFile(join(workspace, '.harness-evals-reward.txt'), pass ? '1\n' : '0\n');
console.log(pass ? '1' : '0');
process.exitCode = pass ? 0 : 1;
