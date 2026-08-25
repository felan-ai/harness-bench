# harness-bench — Felan agent evaluations and benchmarks

This repository contains reproducible Felan evaluations built on
[`harness-evals`](https://www.npmjs.com/package/harness-evals). It covers adapter
smoke tests, behavior regressions, feature experiments, quality benchmarks, and
cost or latency studies.

Correctness is the primary outcome. Comparative benchmarks run one task against
multiple named agent profiles so every arm shares the same prompt, fixture,
verifier, timeout, and environment.

## Repository layout

```text
harness-evals.yaml                         project defaults and agent catalog
evals/cases/**/*.eval.yaml                 one task definition per case
evals/cases/<family>/<case>/verifier/      hidden case-specific grading assets
evals/fixtures/<name>/<version>/source/    immutable run starting points
evals/fixtures/<name>/<version>/fixture.json
                                            fixture provenance and integrity
evals/runtimes/<name>/Dockerfile           shared toolchain/dependency images
scripts/                                   result analysis and maintenance tools
.harness-evals/                            ignored runs, reports, and caches
```

The harness copies a fixture into a run-local workspace and mounts that writable
copy at `/workspace`; agents never edit the canonical fixture. Runtime images
contain reusable tools or dependencies, not the fixture source. See
[`AGENTS.md`](./AGENTS.md) for the complete authoring conventions.

## Setup

Requirements:

- [Bun](https://bun.sh)
- Docker
- A Vercel AI Gateway credential for live runs in `AI_GATEWAY_API_KEY`

```bash
bun install
bun run list
```

This repository may use an intentional no-save link to a sibling
`harness-evals` checkout. Preserve it during dependency maintenance. The current
workspace-setup and pinned-Felan support must be released in `harness-evals`
before replacing that development link with the registry package.

## Adapter smoke test

The smoke case asks Felan to edit a tiny copied fixture and grades it with an
offline verifier. It disables memory, browser, and web-access extensions so it
tests adapter plumbing rather than extension value.

```bash
export AI_GATEWAY_API_KEY=...
bun run smoke
```

The command makes a live provider call. `bun run list` validates discovery and
configuration without one.

## Prewalk model-routing benchmark

The Storzy authenticated-checkout task runs these profiles:

1. `felan-vercel-gpt56-sol-high-no-prewalk`
2. `felan-vercel-gpt56-luna-medium-no-prewalk`
3. `felan-vercel-gpt56-sol-high-prewalk-luna-medium`

The third profile starts with OpenAI GPT-5.6 Sol/high through Vercel AI Gateway
and automatically enters Prewalk, which routes implementation to exact
`vercel-ai-gateway/openai/gpt-5.6-luna`/medium. The direct Luna arm uses the
same implementation model and thinking level. The smoke profile uses GPT-5.6
Terra/low. All profiles pin Felan `0.14.2`.

Storzy uses a shared runtime that pins Node `22.20.0`, pnpm `9.15.5`, and the
fixture lockfile dependencies. Build it once before running any Storzy case:

```bash
bun run build:storzy-runtime
```

Run the three arms sequentially:

```bash
bun run run --case storzy-authenticated-checkout \
  --agents felan-vercel-gpt56-sol-high-no-prewalk,felan-vercel-gpt56-luna-medium-no-prewalk,felan-vercel-gpt56-sol-high-prewalk-luna-medium \
  --concurrency 1 --attempts 1
bun run compare:prewalk
```

These commands make live, paid provider calls. Repeat with `--attempts N` for a
distribution. The comparison includes failed and timed-out attempts and reports
solve rate, latency, cost, token classes, and observed providers and models. It
also fails when an arm lacks its pinned provider or model, or when the routed arm
lacks `enter_prewalk`.

## Common commands

```bash
bun run list
bun run run --case <case-id> --agents <agent-name>
bun run view
```

Verifiers should run without networking and must reject the untouched fixture.
Before authorizing a paid benchmark, also prove a known-good implementation
receives full reward. Generated artifacts and credentials must remain ignored.
