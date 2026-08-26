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

Both profiles start with OpenAI GPT-5.6 Sol/max through OpenAI Codex OAuth with
Codex fast mode enabled.
`felan-no-prewalk` disables Prewalk; `felan-all` enables it and routes
implementation to the exact `openai-codex/gpt-5.6-luna` target at
medium thinking. The smoke profile uses GPT-5.6 Terra/low but is not part of
this benchmark. The profiles intentionally track the latest Felan release from
npm rather than pinning an exact package version.

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

## BUG-398 output-style benchmark

The `output-style` suite evaluates whether Felan's response-style extension
reduces user-facing output without dropping required information. It runs the
same five tasks under three profiles:

1. `felan-output-style-disabled` — output-style extension disabled;
2. `felan-output-style-concise` — the built-in concise style; and
3. `felan-output-style-explanatory` — the built-in explanatory style.

All profiles use Felan `0.14.2`, the same OpenAI Codex provider/model/thinking
selection, OAuth configuration, timeout, fixture, prompt, and verifier. Normal
built-in extensions remain enabled in every arm; only Prewalk is disabled to
keep execution on one model. The output-style enablement and selected style are
the only differences between arms. The tasks cover support,
planning, review, coding-change summaries, and blocker reports. The coding
verifier is offline and rejects the untouched fixture with reward `0`; a known-
good implementation must receive reward `1` before a paid benchmark is trusted.

List the cases without making a model call:

```bash
bun run list
```

After an explicitly authorized live run, analyze its artifacts:

```bash
bun run run --suite output-style --concurrency 1 --attempts 1
bun run analyze:output-style -- --artifact-root .harness-evals/runs --batch latest \
  --output .harness-evals/output/output-style.json --format json
bun run analyze:output-style -- --artifact-root .harness-evals/runs --batch latest \
  --output .harness-evals/output/output-style.md --format markdown
```

The analyzer keeps final-response metrics separate from total-run accounting:
`finalCharacters` and final assistant-message output tokens are distinct from
the adapter's total input/output/total token rollups, request count, and cost.
If a provider does not report final-message usage, the analyzer records a
documented `characters / 4` estimate instead of presenting it as reported
usage. Fixed output-style prompt additions are reported separately as 0, 280,
and 308 characters per model invocation for disabled, concise, and explanatory
respectively. The cases do not configure an LLM judge, so reported agent cost
does not include evaluation-judge calls; any future judge cost must be reported
as evaluation cost separately.

Generate an anonymized review sheet and its private mapping key, then provide
the completed sheet on a later analysis run:

```bash
bun run analyze:output-style -- --artifact-root .harness-evals/runs --batch latest \
  --review-template .harness-evals/output/output-style-review.csv \
  --review-key .harness-evals/output/output-style-review.key.json
bun run analyze:output-style -- --artifact-root .harness-evals/runs --batch latest \
  --reviews .harness-evals/output/output-style-review.completed.csv \
  --output .harness-evals/output/output-style-reviewed.json --format json
```

Do not commit the review key, completed responses, OAuth data, or generated
`.harness-evals/` artifacts. Preserve failed, timed-out, and incomplete runs
in the analysis; do not report only successful attempts. The analyzer's
findings identify cases where concise output is shorter and successful, and
cases where it loses required facts and therefore needs explanatory context.

Verifiers should run without networking and must reject the untouched fixture.
Before authorizing a paid benchmark, also prove a known-good implementation
receives full reward. Generated artifacts and credentials must remain ignored.
