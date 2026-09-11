# harness-bench — Felan agent evaluations and benchmarks

This repository contains reproducible Felan evaluations built on
[`harness-evals`](https://www.npmjs.com/package/harness-evals). Comparative
benchmarks run the same task against named agent profiles while keeping the
prompt, starting workspace, verifier, timeout, and environment equivalent.
Each profile also declares a stable `comparisonId` and display `label` in its
project configuration. Published reports use the comparison ID—not the technical
agent name—as the deliberate cross-batch grouping key. Renamed technical profiles
can retain an identity, while behaviorally different variants use distinct IDs.
The authored ID is grouping metadata, not a configuration fingerprint.
Profiles are intentionally explicit rather than inherited, so their effective
settings are visible in one place. Felan extension A/Bs and cross-agent
comparisons use separate root configurations.

Profiles normally install the latest published Felan release rather than setting
`config.packageVersion`; the MarkItDown benchmark documents its compatibility
pin separately. Refresh the managed image before a live comparison and record
the resolved release with its results. The extension and agent-comparison
configs disable refresh-time base pulls because dependency cases use a local
runtime; managed recipe layers are still rebuilt without cache.

Correctness is the primary outcome. Cost, token usage, and latency are useful
only when compared against successful runs with equivalent controls.

## Repository layout

```text
felan-extension-evals.yaml                Felan extension suites and profiles
agent-comparison-evals.yaml               cross-agent suites and profiles
smoke-evals.yaml                          isolated smoke case and profile
evals/cases/**/*.eval.yaml                 task definitions
evals/cases/<family>/<case>/verifier/      hidden grading assets
evals/fixtures/<name>/<version>/source/    immutable local starting workspaces
evals/fixtures/<name>/<version>/fixture.json
                                            fixture provenance and integrity
evals/runtimes/felan/Dockerfile            shared Node, pnpm, Git, RTK, and MarkItDown image
scripts/                                   generic project maintenance tools
.harness-evals/                            ignored runs, reports, and caches
```

Because the framework does not auto-discover these root configurations, use the
package scripts below or pass the appropriate `--config` path explicitly when
invoking the CLI directly.

The harness copies a local source, fixture, or exact Git checkout into an
isolated run workspace. The shared runtime contains reusable tools; workspace
setup installs application dependencies online from committed frozen lockfiles.
Hidden verifier assets are mounted only for grading and are not exposed to the
evaluated agent. Public source-backed cases pin a full Git commit; local fixtures
remain available for authored snapshots.

See [`AGENTS.md`](./AGENTS.md) for the complete authoring, fixture, runtime,
verifier, validation, and paid-run conventions.

## Codex comparison

`agent-comparison-evals.yaml` defines `codex-vs-felan-all`, which compares the
official Codex CLI with Felan's default all-enabled extension profile on the
complex authenticated Storzy checkout task. See
[`evals/cases/agent-comparison/README.md`](./evals/cases/agent-comparison/README.md)
for controls, verifier details, and the authorized run command. Listing is
offline; the benchmark run requires explicit provider authorization.

## Setup

Requirements:

- [Bun](https://bun.sh)
- Docker
- Git
- Credentials required by any selected live agent profile

```bash
bun install
bun run list
bun run list:comparison
bun run list:smoke
```

This repository may use an intentional no-save link to a sibling
`harness-evals` checkout. Preserve that link during dependency maintenance
unless replacing it is explicitly requested.

## Commands

```bash
bun run list                               # Felan extension configuration
bun run list:comparison                    # cross-agent configuration
bun run list:smoke                         # smoke-only configuration
bun run build:runtime
bun run run --case <case-id> --agents <agent-name> --concurrency 1 --attempts 1
bun run run:comparison --benchmark codex-vs-felan-all --concurrency 1
bun run smoke                              # live smoke run
bun run view                                # latest Felan extension invocation
bun run view:comparison                     # latest cross-agent invocation
bun node_modules/harness-evals/dist/cli.js list --config felan-extension-evals.yaml
bun node_modules/harness-evals/dist/cli.js view --benchmark all --config felan-extension-evals.yaml --no-open # combined benchmarks
bun node_modules/harness-evals/dist/cli.js export --benchmark prewalk --format json --output prewalk.json --config felan-extension-evals.yaml
bun node_modules/harness-evals/dist/cli.js reprocess --source prewalk=<batch-id> --source rtk=<batch-id> --concurrency 1 --config felan-extension-evals.yaml
```

- `list`, `list:comparison`, and `list:smoke` validate their configuration and
  discovery without making a model call.
- `build:runtime` builds the shared Felan Docker runtime.
- `run` and `run:comparison` execute the selected configuration and may consume
  paid or subscription usage.
- `smoke` executes the smoke-only configuration and may consume paid or
  subscription usage.
- `harness-evals reprocess` replays only current network-isolated verifiers
  against explicitly selected retained workspaces. It creates separate,
  non-publishable derived runs, preserves source artifacts, and never executes
  an agent or provider call. Use `--dry-run` to validate the matrix first.
- `view` and `view:comparison` open `.harness-evals/output/latest/`, which
  contains only the last invocation. It is not the combined benchmark dashboard.
  Use `view --benchmark all` to regenerate the dashboard at
  `.harness-evals/output/benchmarks/index.html`.
- Each declared benchmark compares exactly one baseline with one candidate.
  Within `felan-extension-evals.yaml`, non-MarkItDown profiles share an explicit
  controlled baseline with Codex, Tasks, and progressive Context enabled;
  unrelated built-ins stay disabled
  unless they are the feature under test. MarkItDown retains its specialized
  ordinary-`read` profile because Codex replaces that tool surface. Since Felan
  enables newly registered built-ins by default, review and extend these maps
  before running a newer release.
  Every Felan extension benchmark uses provider-reported `cost.total` as its
  primary minimized objective. MarkItDown and RTK additionally minimize
  `usage.promptTokens`; the
  concise output-style benchmark additionally minimizes `usage.outputTokens`.
  The report's full metrics matrix also retains duration, cache, request,
  quality, cost, token, and custom numeric metrics.
  The combined report shows the case-balanced average goal-aware gain and the
  minimum-to-maximum case range. Positive values move in the objective's desired
  direction; quality-regressed movement is not credited as a gain.
  A quality-regressed comparison is marked ineligible and its resource change
  is not credited as an improvement. Output-token metrics are provider-reported;
  the benchmarks do not estimate tokens from word or character counts. Detail
  pages retain per-test and per-attempt status, failed assertion IDs, verifier
  failures, and timeout categories separately from the aggregate quality gate.
- The Prewalk benchmark compares organic routing with Prewalk disabled across
  two coding tasks: the authenticated checkout task and a historical
  memory-summary-links regression pinned to its pre-fix Felan commit. The
  project-instructions task remains RTK-only because it did not reliably trigger
  organic Prewalk entry. Prompts describe outcomes and constraints without
  requesting Prewalk or prescribing an implementation plan. Hidden verifiers
  exercise observable behavior plus the documented source boundaries rather than
  a required code shape. Every candidate attempt must make a successful
  `enter_prewalk` call; a missing or failed entry is a failed attempt. The
  baseline must never call the tool. The matrix is 12 attempts at three trials
  per case.
- RTK uses the project-instructions and checkout tasks with the same
  outcome-oriented prompts. The open-ended `memory-summary-links` task remains
  available as a regression eval but is excluded from this resource benchmark
  because execution-path variance can dominate optimizer savings. The RTK
  matrix is 12 attempts at three trials per case.
- The Subagents benchmark gives Sol/max the single instruction `Explore this
  repository.` against Felan revision
  `5e67c921794c00ad23e0a223299a2a1fc8a0f3fd`. Its six-attempt matrix compares
  `felan-no-subagents` with `felan-delegated-exploration`; the profiles are
  identical apart from `builtinExtensions.subagents` being `false` or `true`.
  A candidate attempt must organically make at least one successful `Agent`
  call with `subagent_type: explore`; the bundled read-focused profile uses the
  low model tier with thinking off. The control must make no `Agent` calls. The
  benchmark minimizes `cost.total` and `usage.promptTokens`, retains output
  tokens in the full metrics matrix, and uses three trials per arm with an 0.8
  quality pass-rate gate. Current Felan headless telemetry reports only the root
  session, so total cost and token conclusions require descendant-session usage
  aggregation before a provider-backed result is treated as authoritative.
- The Session Compaction benchmark resumes a sanitized prefix of real local
  Felan session `01a042ca-0d42-75eb-aeac-0397822915e2`. Its 234 entries record
  implementation of the harness-evals public-results archive and an important
  decision reversal from AWS/S3 to filesystem-first storage. The prefix ends
  immediately before its first historical compaction at 217,549 measured
  tokens; no synthetic messages or token watermark are added. Native Pi and
  Felan compaction with its default inherited model uses the same active model,
  prompt, cut settings,
  and Codex timing controls. A structured hidden verifier separately reports
  checkpoint and continuation fidelity, requires the latest storage decision,
  and rejects stale AWS/S3 state. The custom project adapter includes the
  compaction event's provider-reported usage in `cost.total`; the standard
  parser otherwise sees only assistant message usage. The matrix is six paid
  attempts (three trials per arm) and has not been run without authorization.
Do not start a provider-backed run without explicit authorization.

## Reports and artifacts

Harness-evals writes built-in HTML, JSON, and CSV reports together with detailed
per-run artifacts under the ignored `.harness-evals/` directory. Use those
reports for correctness, duration, cost, token usage, assertions, verifier
results, and workspace changes. All three project configurations intentionally
share the same artifact and output roots, so the latest report reflects whichever
configuration ran most recently.

Preserve failed, timed-out, and incomplete attempts in comparisons. Do not
commit generated reports, run artifacts, credentials, or local authentication
state.
