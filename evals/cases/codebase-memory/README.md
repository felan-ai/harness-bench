# codebase-memory case family

A/B comparison for the Codebase Memory (CBM) extension in Felan — the same
prompt is run against Felan with CBM off (`felan-cbm-off`) and CBM on
(`felan-cbm-on`), and the answers, tokens, cost, and latency are compared.

This is the standing benchmark for the Codebase Memory extension. It is not
tied to any one investigation: run it on every `codebase-memory-mcp` release,
every `@felan-ai/ext-codebase-memory` bump, and any felan change that touches
how the extension resolves or indexes a project root.

This directory currently implements the fast Tier 0 query suite, in single-repo
and multi-repo variants. Tier 1–3 coding tasks (C1–C5) are designed but not yet
built. Background reading lives in the `FelanAI` workspace
(`bug-374-cbm-benchmark-plan.md` for the case designs,
`bug-374-codebase-memory-testing-summary.md` for the manual findings that
motivated the multi-repo variant).

## IMPORTANT: why these cases override `workspace.containerPath`

`codebase-memory-mcp` 0.10.8 carries an internal denylist of "too broad" index
roots, and **`/workspace` is on it**. Indexing any path mounted at `/workspace`
fails with:

```
/workspace: path is too broad to index as one root; name a project directory below it
```

harness-evals mounts workspaces at `/workspace` by default, so every CBM run
before 2026-09-01 silently produced **no index at all** — in both the
single-repo and multi-repo suites. The `felan-cbm-on` arm still had the CBM
tools registered, so it looked like it was working: it just burned tool calls
on failed `index_repository` retries and then fell back to shell grep, doing
exactly what the `felan-cbm-off` arm does. Any A/B number produced under that
condition measures grep-vs-grep-plus-overhead, not CBM.

The denylist is path-shaped, not content-shaped. Verified against 0.10.8 with
identical two-sub-repo content at each path:

| Root | Result |
| --- | --- |
| `/workspace` | **refused** — "too broad" |
| `/srv/FelanAI` | indexed |
| `/opt/proj/FelanAI` | indexed |
| `/Users/yav/Projects/FelanAI` | indexed |
| `/home/yav/Projects/FelanAI` | indexed |
| `/root/Projects/FelanAI` | indexed |
| `/a/b/c/d/FelanAI` | indexed |

So every case in this family pins a realistic project path instead:

- single-repo cases → `containerPath: /home/dev/Projects/felan`
- multi-repo cases → `containerPath: /home/dev/Projects/FelanAI`

`workspace.containerPath` is the mount target, the agent's cwd, and the
verifier's cwd, so the prompt's answer-file path and `verify.mjs`'s
`answerPath`/`rewardPath` must be kept in sync with it.

**If you add a new CBM case, do not leave it at the default `/workspace`.**
Confirm the index actually built by grepping the run's `records.jsonl` for
`too broad` (expect zero) and for a `"project"` name in a
`search_and_read_symbols` result.


## Layout

```text
codebase-memory/
  README.md                              # this file
  query-find-definition-singlerepo/      # Q1: locate ProjectService definition
  query-find-callers-singlerepo/         # Q2: list callers of ProjectService.gitRoot
  query-structural-cross-ref-singlerepo/ # Q3: classes whose ctor takes runtime: AgentRuntime
  query-text-search-singlerepo/          # Q4: files referencing a SHA-256 literal
  query-not-found-singlerepo/            # Q5: honest not-found for a missing class
  query-*-multirepo/                     # the same five, against a parent-of-repos workspace
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
| `cbm-q-find-definition-singlerepo`           | Where is the `ProjectService` class defined? Answer with a `file:line`.                                                           | Grep — simple lookup.                                                |
| `cbm-q-find-callers-singlerepo`              | List every caller of `ProjectService.gitRoot` as `file:line`.                                                                     | CBM on precision (excludes the unrelated `apps/tui/src/memory/project.ts` mention); grep on speed. |
| `cbm-q-structural-cross-ref-singlerepo`      | List every TypeScript class whose constructor takes `runtime: AgentRuntime`.                                                      | CBM if `search_and_read_symbols` filters constructors reliably; otherwise grep can match by text. |
| `cbm-q-text-search-singlerepo`               | Find every file that references the SHA `2fdd4d…3475`. List paths only.                                                            | Grep — pure text search.                                             |
| `cbm-q-not-found-singlerepo`                 | Find the class `SessionRunner`. (It doesn't exist in this repo.)                                                                  | Tie — measures whether the agent honestly reports a null result and how many tool calls it burns to reach it. |

## Benchmark declaration

The benchmark `codebase-memory-queries-singlerepo` (declared at the bottom of
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
  --benchmark codebase-memory-queries-singlerepo
```

View the results:

```bash
bun run node_modules/harness-evals/dist/cli.js view \
  --config harness-evals.yaml \
  --benchmark codebase-memory-queries-singlerepo \
  --open
```

## Version bumps

When a new `codebase-memory-mcp` release ships:

1. Bump `CBM_VERSION` and the two architecture SHAs in
   `evals/runtimes/felan-cbm/Dockerfile`.
2. Rebuild the runtime: `bun run build:runtime felan-cbm`.
3. Re-run `codebase-memory-queries-singlerepo`.

When a new felan release ships with CBM changes:

1. Update `packageVersion` on both `felan-cbm-off` and `felan-cbm-on` in
   `harness-evals.yaml`.
2. If the fixture commit needs to move, update `workspace.git.commit` in each
   case file, refresh
   `evals/runtimes/felan-cbm/context/{.npmrc,pnpm-lock.yaml,pnpm-workspace.yaml}`
   from the target commit, and update `org.harness-bench.source-commit` and
   `org.harness-bench.dependency-lock-sha256` in the Dockerfile.

---

## Multi-repo variant (`*-multirepo`)

The five `query-*-multirepo` cases ask the **same five questions** against a
different workspace shape: a parent directory that is **not itself a Git
repository**, holding two real repositories side by side.

```text
/workspace/                 # not a Git repo
  felan/                    # felan @ 7ae8f94  (555 files)
  felan-platform/           # felan-platform @ b0cec02  (2,426 files)
```

### Why

`ProjectService.gitRoot()` (CBM extension 0.1.2) silently falls back to
`runtime.cwd` when `git rev-parse --show-toplevel` fails, and `index()` passes
that path straight to `index_repository` with no validation. Launched from a
parent-of-repos directory, the extension therefore indexes the whole subtree as
one project — confirmed in this fixture, where both repos land in a single
project named `home-dev-Projects-FelanAI`.

This variant measures what that costs in answer quality, tokens, and latency —
how the extension behaves as workspace scope grows from one repository to
several, against the same five questions.

### Fixture

`evals/fixtures/felan-multirepo/v1/source` — a checked-in `git archive` export
of each pinned commit. `fixture.json` records the commits, file counts, and
ground-truth notes. No file contents were modified.

`.git` directories are not part of the fixture (harness-evals copies workspaces
without Git metadata unless `workspace.git` is used). This does not affect the
behavior under test: `ProjectService.gitRoot()` runs at `/workspace`, and
`/workspace` is non-Git either way.

`workspace.setup` runs `pnpm install --offline --frozen-lockfile` with
`cwd: /workspace/felan` only. The runtime image's offline store is built from
felan's lockfile, so felan's dependency tree matches the single-repo fixture
exactly and the two benchmarks stay comparable. `felan-platform/` is left
uninstalled.

### Ground-truth deltas vs. the single-repo cases

felan-platform was chosen partly because it does **not** collide with the query
ground truth: it contains no `ProjectService`, no `gitRoot` reference, and no
occurrence of the SHA-256 literal. Two things do change:

| Case | Change |
| --- | --- |
| `find-definition`, `find-callers`, `text-search` | Verifiers now require the `felan/` sub-directory prefix on expected paths, so a bare repo-relative answer no longer passes. `find-callers`'s forbidden-match pattern stays un-prefixed so a bare false positive is still caught. |
| `structural-cross-ref` | Unchanged. felan-platform adds `runtime: AgentRuntime` distractors (`apps/agent/src/agent-core.ts:137` plus docs) but no class whose constructor takes one, so the required set is still ProjectService / CbmClient / CacheManager. |
| `not-found` | **Queries `WorkspaceReconciler` instead of `SessionRunner`.** `SessionRunner` *does* exist in felan-platform (`apps/agent/src/sessions/session-runner.ts:224`), so it is not a not-found question in this fixture. `WorkspaceReconciler` is absent from both repositories, preserving the case's semantics. |

### Benchmark declaration

`codebase-memory-queries-multirepo` in `../../../harness-evals.yaml` — same two
arms, same gates and objective as `codebase-memory-queries-singlerepo`, `trials: 3`.

```bash
bunx harness-evals run --config harness-evals.yaml \
  --benchmark codebase-memory-queries-multirepo --concurrency 3
```
