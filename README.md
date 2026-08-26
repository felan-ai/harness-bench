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
- A ChatGPT Plus or Pro account for OpenAI Codex OAuth

```bash
bun install
bun run list
```

This repository may use an intentional no-save link to a sibling
`harness-evals` checkout. Preserve it during dependency maintenance. The
published dependency and lockfile remain pinned to the compatible `0.2.5`
release while that local development link is active.

## Adapter smoke test

The smoke case asks Felan to edit a tiny copied fixture and grades it with an
offline verifier. It disables memory, browser, and web-access extensions so it
tests adapter plumbing rather than extension value.

```bash
bun run smoke
```

On the first live run, harness-evals starts the OpenAI Codex OAuth flow and
stores the resulting credentials in the ignored
`.harness-evals/auth/felan/default/auth.json` file. The command consumes live
subscription usage. `bun run list` validates discovery and configuration
without authenticating or making a model call.

## Prewalk model-routing benchmark

The Storzy authenticated-checkout task runs these profiles:

1. `felan-no-prewalk`
2. `felan-all`

Both profiles start with OpenAI GPT-5.6 Sol/high through OpenAI Codex OAuth.
`felan-no-prewalk` disables Prewalk; `felan-all` enables it and routes
implementation to the exact `openai-codex/gpt-5.6-luna` target at
medium thinking. The smoke profile uses GPT-5.6 Terra/low but is not part of
this benchmark. All profiles pin Felan `0.14.2`.

Storzy uses a shared runtime that pins Node `22.20.0`, pnpm `9.15.5`, and the
fixture lockfile dependencies. Build it once before running any Storzy case:

```bash
bun run build:storzy-runtime
```

Run both arms sequentially:

```bash
bun run run --case prewalk-checkout --concurrency 1 --attempts 1
bun run view
```

These commands consume live subscription usage. Repeat with `--attempts N` for
a distribution. The built-in report compares solve rate, latency, reported
cost, and token usage. The case assertions also require a successful
`enter_prewalk` call for `felan-all` and reject any such call for
`felan-no-prewalk`.

## Common commands

```bash
bun run list
bun run run --case <case-id> --agents <agent-name>
bun run view
```

Verifiers should run without networking and must reject the untouched fixture.
Before authorizing a paid benchmark, also prove a known-good implementation
receives full reward. Generated artifacts and credentials must remain ignored.
