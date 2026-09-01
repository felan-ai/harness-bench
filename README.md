# harness-bench — Felan agent evaluations and benchmarks

This repository contains reproducible Felan evaluations built on
[`harness-evals`](https://www.npmjs.com/package/harness-evals). Comparative
benchmarks run the same task against named agent profiles while keeping the
prompt, starting workspace, verifier, timeout, and environment equivalent.
Each profile also declares a stable `comparisonId` and display `label` in its
project configuration. Published reports use the comparison ID—not the technical
agent name—as the deliberate cross-batch grouping key. Renamed technical profiles
can retain an identity, while behaviorally different variants use distinct IDs.
The authored ID is grouping metadata, not a configuration fingerprint. Profiles
are intentionally explicit rather than inherited, so their effective settings are
visible in one place.

Profiles install the latest published Felan release rather than setting
`config.packageVersion`. Refresh the managed image before a live comparison and
record the resolved release with its results. The main config disables
refresh-time base pulls because dependency cases use a local generic runtime;
managed recipe layers are still rebuilt without cache.

Correctness is the primary outcome. Cost, token usage, and latency are useful
only when compared against successful runs with equivalent controls.

## Repository layout

```text
harness-evals.yaml                         non-smoke suites and agent profiles
harness-evals.smoke.yaml                   isolated smoke case and profile
evals/cases/**/*.eval.yaml                 task definitions
evals/cases/<family>/<case>/verifier/      hidden grading assets
evals/fixtures/<name>/<version>/source/    immutable local starting workspaces
evals/fixtures/<name>/<version>/fixture.json
                                            fixture provenance and integrity
evals/runtimes/felan/Dockerfile            shared Node, pnpm, Git, and RTK image
scripts/                                   generic project maintenance tools
.harness-evals/                            ignored runs, reports, and caches
```

The harness copies a local source, fixture, or exact Git checkout into an
isolated run workspace. The shared runtime contains reusable tools; workspace
setup installs application dependencies online from committed frozen lockfiles.
Hidden verifier assets are mounted only for grading and are not exposed to the
evaluated agent. Public source-backed cases pin a full Git commit; local fixtures
remain available for authored snapshots.

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
bun run list:smoke
```

This repository may use an intentional no-save link to a sibling
`harness-evals` checkout. Preserve that link during dependency maintenance
unless replacing it is explicitly requested.

## Commands

```bash
bun run list                               # non-smoke configuration
bun run list:smoke                         # smoke-only configuration
bun run build:runtime
bun run run --case <case-id> --agents <agent-name> --concurrency 1 --attempts 1
bun run smoke                              # live smoke run
bun run view
bun node_modules/harness-evals/dist/cli.js list --config harness-evals.yaml
bun node_modules/harness-evals/dist/cli.js view --benchmark all --config harness-evals.yaml --no-open
bun node_modules/harness-evals/dist/cli.js export --benchmark prewalk --format json --output prewalk.json --config harness-evals.yaml
```

- `list` and `list:smoke` validate their configuration and discovery without
  making a model call.
- `build:runtime` builds the shared Felan Docker runtime.
- `run` executes the selected evaluation and may consume paid or subscription
  usage.
- `smoke` executes the smoke-only configuration and may consume paid or
  subscription usage.
- `view` opens the framework's built-in report.
- Each declared benchmark compares exactly one baseline with one candidate.
  The combined report shows the case-balanced average percentage gain and the
  minimum-to-maximum case gain. Positive gain is better after accounting for
  whether the objective is minimized or maximized. The concise benchmark uses
  provider-reported `usage.outputTokens`; it does not estimate tokens from word
  or character counts. Detail pages retain per-test and per-attempt status,
  failed assertion IDs, verifier failures, and timeout categories separately
  from the aggregate quality gate.
- Prewalk and RTK each cover three shared coding tasks: the original benchmark
  task, the other benchmark's task, and a historical memory-summary-links
  regression pinned to its pre-fix Felan commit. The expanded matrix is 18
  attempts per benchmark at three trials per case.
- Web access compares the enabled and disabled extension across five
  source-backed research tasks. Its primary objective is provider-reported
  `cost.total`, gated on every attempt passing, for 30 attempts at three trials
  per case.

Do not start a provider-backed run without explicit authorization.

## Reports and artifacts

Harness-evals writes built-in HTML, JSON, and CSV reports together with detailed
per-run artifacts under the ignored `.harness-evals/` directory. Use those
reports for correctness, duration, cost, token usage, assertions, verifier
results, and workspace changes. Both project configurations intentionally share
the same artifact and output roots, so the latest report reflects whichever
configuration ran most recently.

Preserve failed, timed-out, and incomplete attempts in comparisons. Do not
commit generated reports, run artifacts, credentials, or local authentication
state.
