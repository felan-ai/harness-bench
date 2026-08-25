import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const workspace = process.cwd();
const tests = '/tests';
const tempDir = join(workspace, '.harness-verifier-tmp');
const failures = [];

function fail(message) {
  failures.push(message);
}

async function source(path) {
  return readFile(join(workspace, path), 'utf8').catch(() => '');
}

function requireText(text, patterns, label) {
  for (const pattern of patterns) {
    if (!pattern.test(text)) fail(`${label}: missing ${pattern}`);
  }
}

async function run(command, args, options = {}) {
  return new Promise((resolveResult) => {
    const child = spawn(command, args, {
      cwd: workspace,
      env: { ...process.env, TMPDIR: tempDir, TMP: tempDir, TEMP: tempDir, ...options.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (code, signal) => resolveResult({ code: code ?? 1, signal, stdout, stderr }));
    child.on('error', (error) => resolveResult({ code: 1, signal: undefined, stdout, stderr: `${stderr}${error.message}` }));
  });
}

async function verifyBaselineChanged() {
  const baseline = JSON.parse(await readFile(join(tests, 'baseline.json'), 'utf8'));
  for (const [path, expected] of Object.entries(baseline)) {
    const value = await source(path);
    const actual = createHash('sha256').update(value).digest('hex');
    if (actual === expected) fail(`task did not modify ${path}`);
  }
}

async function verifySourceContract() {
  const login = await source('app/page.tsx');
  const header = await source('components/header.tsx');
  const checkout = await source('app/checkout/page.tsx');
  const receipt = await source('app/checkout-complete/page.tsx');
  const inventory = await source('app/inventory/page.tsx');
  const apiStore = await source('lib/api-store.ts');
  const rejectedOrderResponse = /!response\.ok|response\.status\s*!==?\s*201/s;
  const acceptedOrderResponse = /if\s*\(\s*(?:response\.ok|response\.status\s*===?\s*201)/s;
  const orderResponseCheck = /!response\.ok|response\.status\s*!==?\s*201|if\s*\(\s*(?:response\.ok|response\.status\s*===?\s*201)/s;
  const clearCart = /localStorage\.removeItem\(\s*["'`]cart["'`]/s;

  requireText(login, [
    /fetch\s*\(\s*["'`]\/api\/auth\/login/s,
    /response\.ok/s,
    /response\.json\(\)/s,
    /localStorage\.setItem\(\s*["'`]currentUser/s,
    /localStorage\.setItem\(\s*["'`]authToken/s,
  ], 'login');
  if (/localStorage\.setItem\(\s*["'`]currentUser["'`]\s*,\s*username/s.test(login)
      && !/authToken/s.test(login)) fail('login: bypasses the authentication response');

  requireText(header, [
    /localStorage\.removeItem\(\s*["'`]currentUser/s,
    /localStorage\.removeItem\(\s*["'`]authToken/s,
  ], 'logout');

  requireText(checkout, [
    /fetch\s*\(\s*["'`]\/api\/orders/s,
    /method\s*:\s*["'`]POST/s,
    /Authorization/s,
    /Bearer/s,
    /JSON\.stringify/s,
    /localStorage\.getItem\(\s*["'`]authToken/s,
    orderResponseCheck,
    clearCart,
    /setIsLoading\(true\)/s,
    /cartItems\.length\s*===\s*0|items\.length\s*===\s*0|Object\.keys\(cart\).*length\s*===\s*0/s,
  ], 'checkout');
  const clearCartIndex = checkout.search(clearCart);
  const rejectedResponseIndex = checkout.search(rejectedOrderResponse);
  const acceptedResponseIndex = checkout.search(acceptedOrderResponse);
  const failureGuardExits = rejectedResponseIndex >= 0
    && rejectedResponseIndex < clearCartIndex
    && /\b(?:return|throw)\b/s.test(checkout.slice(rejectedResponseIndex, clearCartIndex));
  const successBranchClears = acceptedResponseIndex >= 0 && acceptedResponseIndex < clearCartIndex;
  if (clearCartIndex < 0 || (!failureGuardExits && !successBranchClears)) {
    fail('checkout: missing success-gated cart clearing');
  }
  if (!/NEXT_PUBLIC_IMPROVED_CHECKOUT/s.test(checkout)) fail('checkout: removed the improved checkout variant');
  if (!/catch|error/i.test(checkout)) fail('checkout: missing API failure handling');

  requireText(receipt, [
    /Thank You For Your Order/s,
    /localStorage\.getItem\(\s*["'`]lastOrder/s,
    /order|receipt/i,
  ], 'receipt');
  requireText(inventory, [/NEXT_PUBLIC_ADD_TO_CART_BUG/s, /return/s], 'inventory');
  requireText(apiStore, [/storzy-test-token-2024/s, /total\s*\+=\s*product\.price/s], 'api store');
}

async function verifyApiRoutes() {
  const result = await run('pnpm', ['exec', 'vitest', 'run', `${tests}/api-contract.test.ts`, '--config', `${tests}/vitest.config.ts`, '--reporter', 'dot']);
  if (result.code !== 0) fail(`API contract tests failed:\n${result.stdout}\n${result.stderr}`);
}

async function main() {
  await mkdir(tempDir, { recursive: true });
  try {
    if (!existsSync(join(workspace, 'package.json'))) fail('fixture package.json is missing');
    await verifyBaselineChanged();
    await verifySourceContract();
    const typecheck = await run('pnpm', ['typecheck']);
    if (typecheck.code !== 0) fail(`typecheck failed:\n${typecheck.stdout}\n${typecheck.stderr}`);
    const build = await run('pnpm', ['build'], { env: { NEXT_PUBLIC_IMPROVED_CHECKOUT: 'false', NEXT_PUBLIC_ADD_TO_CART_BUG: 'false' } });
    if (build.code !== 0) fail(`build failed:\n${build.stdout}\n${build.stderr}`);
    await verifyApiRoutes();

    const pass = failures.length === 0;
    await writeFile(join(workspace, '.harness-evals-reward.txt'), `${pass ? 1 : 0}\n`);
    for (const failure of failures) console.error(`FAIL: ${failure}`);
    console.log(pass ? '1' : '0');
    process.exitCode = pass ? 0 : 1;
  } finally {
    await Promise.all([
      rm(tempDir, { recursive: true, force: true }),
      rm(join(workspace, '.next'), { recursive: true, force: true }),
      rm(join(workspace, 'tsconfig.tsbuildinfo'), { force: true }),
    ]);
  }
}

await main();
