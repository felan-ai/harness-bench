# codebase-memory case family

A/B comparison for the Codebase Memory (CBM) extension in Felan — the same
prompt is run against Felan with CBM off (`felan-cbm-off`) and CBM on
(`felan-cbm-on`), and the answers, tokens, cost, and latency are compared.

The full benchmark plan lives in
`bug-374-cbm-benchmark-plan.md` (in the `FelanAI` workspace, alongside
`bug-374-codebase-memory-testing-summary.md` which is the motivating manual
report). This directory implements only Day 1 of that plan — the fast Tier 0
query suite. Tier 1–3 coding tasks (C1–C5) are planned but not yet built.

## Layout

```text
codebase-memory/
  README.md                          # this file
  query-find-definition/             # Q1: locate ProjectService definition
  query-find-callers/                # Q2: list callers of ProjectService.gitRoot
  query-structural-cross-ref/        # Q3: list classes whose ctor takes runtime: AgentRuntime
  query-text-search/                 # Q4: find files that reference a SHA-256 literal
  query-not-found/                   # Q5: honest not-found for a missing class
```

Every case has one `case.eval.yaml` and one `verifier/verify.mjs`.

## How grading works

Query cases do not mutate the workspace. Each prompt instructs the agent to
write its final answer to `/workspace/.harness-answer.txt`. The verifier reads
that file inside the container, applies regex checks, and writes a scalar
reward to `.harness-evals-reward.txt` (1.0 on pass, 0.0 on fail).

`verifier.network.mode: none` — verifiers run offline.

The `harness-evals` verifier stage receives only the mounted workspace, not the
agent's `finalOutput`; the answer-file convention is what lets the verifier
grade the agent's answer deterministically.

## Fixture

All five cases share the same starting workspace: a fresh Git checkout of
[`felan-ai/felan`](https://github.com/felan-ai/felan) pinned to commit
`7ae8f94e72095a8bc38bf62b902164d2717f3294`. That commit is the current tip of
`main` at the time of this benchmark and includes the merged CBM extension
(PR #28), its 0.19.1 bump, and the stdio-capabilities work.

`workspace.setup` runs `pnpm install --offline --frozen-lockfile` against the
runtime image's baked dependency store (`/opt/harness-deps/felan-cbm-store`).

## Runtime image

Both arms use `harness-bench-felan-cbm-runtime:v1`, defined at
`evals/runtimes/felan-cbm/Dockerfile`. It is a self-contained image that:

- Pins Node 22.20.0 and pnpm 9.15.5.
- Fetches the felan `pnpm-lock.yaml` at commit `7ae8f94` into an offline pnpm
  store (`/opt/harness-deps/felan-cbm-store`).
- Bakes in the `codebase-memory-mcp` binary at version 0.10.8 by downloading
  the portable release tarball from the DeusData GitHub release and
  verifying its SHA-256. This is baked in so the `felan-cbm-on` arm does not
  pay a ~30 s install cost at session start — the difference we want to
  measure is CBM's query behavior, not its installer.

Bump `CBM_VERSION` (and the matching architecture SHAs) in the Dockerfile
when re-benchmarking a new codebase-memory-mcp release.

## Arms

Both arms are declared in `../../../harness-evals.yaml`:

- `felan-cbm-off` — every builtin extension disabled except `codex`.
- `felan-cbm-on` — identical, plus `codebaseMemory: true`.

Everything else (model, thinking level, adapter, timeout, auth) is pinned
identical between arms so the only meaningful difference is the CBM flag.

## Cases

| Case                              | Question                                                                                                                          | Predicted winner                                                     |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `cbm-q-find-definition`           | Where is the `ProjectService` class defined? Answer with a `file:line`.                                                           | Grep — simple lookup.                                                |
| `cbm-q-find-callers`              | List every caller of `ProjectService.gitRoot` as `file:line`.                                                                     | CBM on precision (excludes the unrelated `apps/tui/src/memory/project.ts` mention); grep on speed. |
| `cbm-q-structural-cross-ref`      | List every TypeScript class whose constructor takes `runtime: AgentRuntime`.                                                      | CBM if `search_and_read_symbols` filters constructors reliably; otherwise grep can match by text. |
| `cbm-q-text-search`               | Find every file that references the SHA `2fdd4d…3475`. List paths only.                                                            | Grep — pure text search.                                             |
| `cbm-q-not-found`                 | Find the class `SessionRunner`. (It doesn't exist in this repo.)                                                                  | Tie — measures whether the agent honestly reports a null result and how many tool calls it burns to reach it. |

## Benchmark declaration

The benchmark `codebase-memory-queries` (declared at the bottom of
`harness-evals.yaml`) runs all five cases against both arms, 3 trials per
`(case, arm)` — 30 runs per run of the benchmark.

- **Quality gate:** `quality.passRate >= 0.8` (at least 4 of 5 verifiers must
  pass across the trials for an arm to be considered eligible).
- **Objective:** `cost.total`, minimize.
- **Secondary metrics reported:** `duration.ms`, `usage.promptTokens`,
  `usage.outputTokens`.

Run the benchmark with:

```bash
bun run node_modules/harness-evals/dist/cli.js run \
  --config harness-evals.yaml \
  --benchmark codebase-memory-queries
```

View the results:

```bash
bun run node_modules/harness-evals/dist/cli.js view \
  --config harness-evals.yaml \
  --benchmark codebase-memory-queries \
  --open
```

## Version bumps

When a new `codebase-memory-mcp` release ships:

1. Bump `CBM_VERSION` and the two architecture SHAs in
   `evals/runtimes/felan-cbm/Dockerfile`.
2. Rebuild the runtime: `bun run build:runtime felan-cbm`.
3. Re-run `codebase-memory-queries`.

When a new felan release ships with CBM changes:

1. Update `packageVersion` on both `felan-cbm-off` and `felan-cbm-on` in
   `harness-evals.yaml`.
2. If the fixture commit needs to move, update `workspace.git.commit` in each
   case file, refresh
   `evals/runtimes/felan-cbm/context/{.npmrc,pnpm-lock.yaml,pnpm-workspace.yaml}`
   from the target commit, and update `org.harness-bench.source-commit` and
   `org.harness-bench.dependency-lock-sha256` in the Dockerfile.
