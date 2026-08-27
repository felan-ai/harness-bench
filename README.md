# harness-bench — Felan agent evaluations and benchmarks

This repository contains reproducible Felan evaluations built on
[`harness-evals`](https://www.npmjs.com/package/harness-evals). Comparative
benchmarks run the same task against named agent profiles while keeping the
prompt, starting workspace, verifier, timeout, and environment equivalent.

Correctness is the primary outcome. Cost, token usage, and latency are useful
only when compared against successful runs with equivalent controls.

## Repository layout

```text
harness-evals.yaml                         project defaults and agent catalog
evals/cases/**/*.eval.yaml                 task definitions
evals/cases/<family>/<case>/verifier/      hidden grading assets
evals/fixtures/<name>/<version>/source/    immutable local starting workspaces
evals/fixtures/<name>/<version>/fixture.json
                                            fixture provenance and integrity
evals/runtimes/<name>/Dockerfile           shared toolchain/dependency images
scripts/                                   generic project maintenance tools
.harness-evals/                            ignored runs, reports, and caches
```

The harness copies a local source, fixture, or exact Git checkout into an
isolated run workspace. Runtime images contain reusable tools and immutable
dependencies, not the workspace source. Hidden verifier assets are mounted only
for grading and are not exposed to the evaluated agent.

See [`AGENTS.md`](./AGENTS.md) for the complete authoring, fixture, runtime,
verifier, validation, and paid-run conventions.

## Setup

Requirements:

- [Bun](https://bun.sh)
- Docker
- Git
- Credentials required by any selected live agent profile

```bash
bun install
bun run list
```

This repository may use an intentional no-save link to a sibling
`harness-evals` checkout. Preserve that link during dependency maintenance
unless replacing it is explicitly requested.

## Commands

```bash
bun run list
bun run build:runtime <runtime-name>
bun run run --case <case-id> --agents <agent-name> --concurrency 1 --attempts 1
bun run view
```

- `list` validates configuration and discovery without making a model call.
- `build:runtime` builds a named reusable Docker runtime.
- `run` executes the selected evaluation and may consume paid or subscription
  usage.
- `view` opens the framework's built-in report.

Do not start a provider-backed run without explicit authorization.

## Reports and artifacts

Harness-evals writes built-in HTML, JSON, and CSV reports together with detailed
per-run artifacts under the ignored `.harness-evals/` directory. Use those
reports for correctness, duration, cost, token usage, assertions, verifier
results, and workspace changes.

Preserve failed, timed-out, and incomplete attempts in comparisons. Do not
commit generated reports, run artifacts, credentials, or local authentication
state.
