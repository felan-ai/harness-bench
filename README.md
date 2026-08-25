# harness-bench — Felan agent evaluations and benchmarks

This repository contains reproducible evals and benchmarks for the Felan agent, run
through [`harness-evals`](https://www.npmjs.com/package/harness-evals). It is intended
to grow with Felan and cover adapter smoke tests, behavior regressions, feature
experiments, quality benchmarks, and cost or latency studies.

The initial benchmark family measures the effect of individual extensions by
comparing identical tasks under controlled Felan configurations. That is one use
case, not a limit on the repository's scope.

## Repository layout

```text
harness-evals.yaml                         canonical harness configuration
evals/tests/smoke/felan-adapter/            deterministic adapter smoke case
evals/tests/smoke/felan-adapter/fixture/    isolated starting workspace

evals/tests/<family>/                      future eval and benchmark families
.harness-evals/                            ignored run artifacts and local caches
```

Each case should keep its fixture, prompt, and offline verifier reproducible.
Comparative benchmarks should use controlled arms that differ only in the behavior
under test. Verifiers should grade objective workspace or response outcomes, not tool
usage by itself.

## Setup

Requirements:

- [Bun](https://bun.sh)
- Docker
- A provider credential, normally `GEMINI_API_KEY`
- A local `harness-evals` checkout may be linked with `bun link --no-save`; preserve
  that link when changing dependencies

Install dependencies:

```bash
bun install
```

The canonical config is discovered automatically:

```bash
bun run list
```

## Smoke test

The smoke case asks Felan to edit a tiny fixture and grades it with an offline
verifier. It intentionally disables the built-in memory, browser, and web-access
extensions so it tests adapter plumbing rather than extension value:

```bash
export GEMINI_API_KEY=...
bun run smoke
```

For discovery without an API call:

```bash
bun run list
```

The smoke verifier runs with networking disabled. Agent runs require network access
for the Felan package installation and model provider. Credentials must remain in
environment variables or local agent configuration; never commit them.

## Authoring evals and benchmarks

1. Add a case under `evals/tests/<family>/` with a stable suite and id.
2. Keep immutable fixtures separate from verifier assets when the agent must not see
   expected answers.
3. Define objective success criteria before selecting secondary metrics.
4. For comparative experiments, keep provider, model, thinking level, prompt,
   fixture, timeout, attempts, and credential policy equivalent between arms.
5. Record the exact agent and feature configuration needed to reproduce each arm.
6. Capture correctness first, then compare relevant metrics such as token classes,
   cost, tool calls, retries, and latency.
7. Keep live external services separate from replayed or frozen primary fixtures.

Run a focused case with:

```bash
bun run run --case <case-id> --agents <agent-name>
```

Inspect the latest report with:

```bash
bun run view
```

Generated runs, reports, image caches, and local credentials belong under ignored
`.harness-evals/`. Do not add generated result exports to the active repository
unless a specific experiment requires a reviewed artifact.
