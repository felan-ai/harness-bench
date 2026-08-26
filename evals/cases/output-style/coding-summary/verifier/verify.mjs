import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const workspace = process.cwd();
const path = join(workspace, 'src', 'calculator.js');
const source = await readFile(path, 'utf8').catch(() => '');
const implemented = /export\s+function\s+add\s*\(\s*left\s*,\s*right\s*\)\s*\{[\s\S]*?return\s+left\s*\+\s*right\s*;?[\s\S]*?\}/.test(source)
  && !source.includes('not implemented');
await writeFile(join(workspace, '.harness-evals-reward.txt'), `${implemented ? 1 : 0}\n`);
console.log(implemented ? '1' : '0');
process.exitCode = implemented ? 0 : 1;
