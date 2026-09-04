# codebase-memory case family

A/B comparison for Felan's **Codebase Memory (CBM)** extension
(`@felan-ai/ext-codebase-memory`, a proxy over the native `codebase-memory-mcp`
binary). The same task is run against Felan with CBM off (`felan-cbm-off`) and
CBM on (`felan-cbm-on`); everything else — model, thinking level, prompt,
starting workspace, verifier, timeout, auth — is held identical, so the only
variable is the extension.

**Hypothesis.** CBM's structural graph (symbol lookup, callers, cross-file
impact) should reduce tokens and dead-end tool calls on tasks that force the
agent to traverse relationships across many files, and be neutral-to-negative on
localized tasks (its MCP tool schemas cost tokens every turn, and it indexes at
session start).

This is the standing benchmark for the extension: re-run it on every
`codebase-memory-mcp` release, every `@felan-ai/ext-codebase-memory` bump, and
any Felan change to how the extension resolves or indexes a project root.

> **Run findings live in a separate snapshot.** Point-in-time results and the
> transcript root-cause analysis are in
> [`cbm-initial-findings.md`](./cbm-initial-findings.md) (rendered:
> `cbm-initial-findings.html`). This README stays a living description of the
> cases, arms, and how to run them. See [Findings](#findings) below.

## Cases

| Case | Task | Traversal demand |
| --- | --- | --- |
| `project-instructions` | Fix a real historical Felan regression — session creation must load root `AGENTS.md`/`CLAUDE.md` via `AgentRuntime` with exact precedence and nonfatal rules. Confined to `packages/agent-core/src`. | Moderate, single-package. Chosen to prove the pipeline, not to showcase CBM. |
| `extension-config-scope` | Add a required persistence `scope` (`user`/`project`/`session`) to Felan's declarative extension-config system: one interface change in `agent-core`, a new `getPersistableExtensionConfig`, a `settings.ts` consumer change, and `scope` on all ~50 `configField.*` sites across 11 `ext-*` packages. | High, cross-package fan-out — the case built to give CBM its best shot. |
| `extension-architecture` | Read-only deep-dive: explain how Felan's extension system is designed and implemented (contract, loading, declarative config, builtin enable/disable, tool-to-model path, one worked example), written to `EXTENSION-ARCHITECTURE.md`. No edits, no build, no tests — graded by a hidden fact-coverage × citation-precision checklist instead of a build/test verifier. | High, comprehension-only across `packages/` and `apps/` — isolates CBM's retrieval value from edit/build noise entirely. |

## Arms

Both declared in `../../../felan-extension-evals.yaml`, identical except one flag:

| | `felan-cbm-off` | `felan-cbm-on` |
| --- | --- | --- |
| `builtinExtensions.codebaseMemory` | `false` | `true` |
| everything else | `codex`, `context`, `tasks` on, all 17 other builtins explicitly `false`; `gpt-5.6-sol`; `thinking: medium`; `packageVersion: 0.21.3`; `timeoutMs: 900000` | same |

Both profiles enumerate all 20 builtin extensions felan 0.21.3 ships. felan
treats an omitted key as enabled (`isBuiltinExtensionEnabled` returns true
unless the value is exactly `false`), so listing every key is what keeps the
baseline from silently picking up extensions on a felan bump.

## Runtime and pinned versions

Cases use `harness-bench-felan-runtime:v1` (`evals/runtimes/felan/Dockerfile`).
That image now bakes the `codebase-memory-mcp` binary onto `PATH` so
`felan-cbm-on` does not pay the installer cost at session start. The binary is
inert for every other case (they do not enable `codebaseMemory`).

The binary version is **not a free choice** — `@felan-ai/ext-codebase-memory`
hard-pins it with a strict equality check (`client.ts`: `CODEBASE_MEMORY_VERSION`).
A mismatch makes the extension register no tools and disable nonfatally, which
would silently turn `felan-cbm-on` into `felan-cbm-off`. Current chain:

| Layer | Version |
| --- | --- |
| `@felan-ai/felan` | 0.21.3 |
| bundled `@felan-ai/ext-codebase-memory` | 0.1.5 |
| required `codebase-memory-mcp` binary | 0.10.8 |

To re-benchmark a newer binary: bump `CBM_VERSION` / `CBM_INSTALLER_COMMIT` /
`CBM_INSTALLER_SHA256` in the Dockerfile (values come from
`packages/ext-codebase-memory/src/{client,installer}.ts` in the felan repo at the
target release), rebuild with `bun run build:runtime`, re-run.

Both cases share `harness-bench-felan-runtime:v1`. The runtime bakes no pnpm
store, so each case's `setup` installs its own commit's lockfile from the npm
registry with `network.mode: default`.

### Why the cases override `workspace.containerPath`

`codebase-memory-mcp` refuses to index a root named `/workspace`, which is
harness-evals' default mount point. Every case here pins a realistic path
instead (`project-instructions` and `extension-config-scope` both use
`/home/dev/felan`). That path is the agent cwd, the workspace mount target, and
the verifier cwd all at once (`src/adapters/felan.ts` resolves cwd from
`containerPath`). The verifier reads `process.cwd()` so it follows the override.
Because the cases use `workspace.git`, `.git` is preserved in the container, so
CBM's `ProjectService.gitRoot()` resolves cleanly to that path — no fallback, no
whole-subtree scope explosion.

**If you add a case, do not leave it at the default `/workspace`.** Confirm the
index actually built: grep the run's `steps/run/stdout.log` for a
`codebase_memory` tool result with a `"project"` name and non-zero
`"nodes"`/`"edges"`.

## How grading works

All three verifiers run with `verifier.network.mode: none` and mount their
hidden grading material read-only in the verifier container only — never
visible to the agent. The untouched fixture must score `0`; a separately
prepared known-good implementation must score `1` (both verified per case).
`project-instructions` and `extension-config-scope` write a binary reward
(build + tests pass, or they don't); `extension-architecture` writes a
continuous `0..1` reward (fact coverage × citation precision), since its task
has no build or test suite to run.

**`project-instructions`** reuses the `rtk/project-instructions` verifier
verbatim (only `process.cwd()` differs). `verifier/verify.mjs`:

1. Boundary check — `git HEAD` is the pinned commit, no remote, every changed
   path under `packages/agent-core/src/`.
2. Copies the hidden spec `verifier/project-instructions.test.ts` into
   `packages/agent-core/test/`.
3. Runs `pnpm --filter @felan-ai/agent-core` `type-check`, then `vitest run` on
   `session.test.ts` + `resource-loader.test.ts` + the hidden test, then `build`.
4. Deletes the hidden test; writes `1` (all passed) or `0`.

Reference fix: src-only slice of felan commit `eaad893`.

**`extension-config-scope`** (`verifier/verify.mjs`): boundary check → build the
whole tui dependency graph (`pnpm --filter @felan-ai/felan... build`) → run the
`agent-core` extension-config tests + a hidden unit spec → run the `apps/tui`
`settings.test.ts` + a hidden classification spec (imports all 11 built configs
and recomputes the rule) + a hidden `settings.ts` scope spec.
`reference-solution.patch` is the validated known-good diff (17 files); applied
to `51a18d8` it builds and every spec passes.

**`extension-architecture`** (`verifier/verify.mjs`): boundary check — pinned
commit, no remote, no changed path other than `EXTENSION-ARCHITECTURE.md` —
then grades the report itself against a hidden `verifier/facts.json`
checklist (12 facts spanning the prompt's six areas; each fact requires all
of its case-insensitive regex patterns, anchored on a real exported symbol
plus a real path fragment, to appear somewhere in the text). `coverage =
factsMatched / 12`. Separately, every `packages/…`/`apps/…`-shaped path cited
anywhere in the report is checked against the workspace with `fs.existsSync`;
`precision = existingCited / totalCited`, forced to `0` below a minimum
citation count (8) so a vague report can't earn credit, and this is what
catches a plausible-sounding but fabricated citation that coverage alone
would miss. `reward = coverage × precision`. Verified locally against a
`e586763` checkout: a hand-written correct report scores `1` (12/12,
9/9 citations resolve); an empty/placeholder report scores `0` (below the
150-word floor); a report with fabricated file paths scores `0` (citations
resolve below the minimum, even where wording partially matches facts); and
a source edit outside `EXTENSION-ARCHITECTURE.md` is rejected at the
boundary check.

## `extension-config-scope` — case design

The `/cwd`-command idea (felan commit `8a58a0a`) was dropped: it bundles the
`/cwd` feature (entirely inside `apps/tui`) with an unrelated skills-injection
change to `ext-codex/src/prompt.ts` — no real cross-package dependency, same
single-package regime as `project-instructions`. The felan history has no clean
multi-package fix, so this case is a **synthetic fan-out refactor** anchored on a
real subsystem (the declarative extension-config system from commit `1906744`).

**Base commit:** `51a18d8` (origin/main, 2026-09-01), much newer than
`project-instructions`' `104faa5`. Both resolve their own lockfile from the npm
registry at setup, so the commit gap costs nothing beyond install time.

**Task:** add a required `scope: 'user' | 'project' | 'session'` to every
extension-config field.

- `agent-core/src/extension-config.ts`: the type + required option; reject
  `sensitive` fields that are not `session`-scoped; new
  `getPersistableExtensionConfig(definitions, overrides, target)` that returns
  only the fields matching `target` (never `session`).
- `apps/tui/src/settings.ts`: `resolveExtensionConfigSettings` drops
  `session`-scoped fields configured in `settings.json`, with a warning.
- Fan-out: `scope` on all ~50 `configField.*` sites across 11 `ext-*` packages
  (plus the broken existing tests).

**Classification rule** (mechanical, so grading carries no opinion; first match
wins): `sensitive: true` → `session`; `configField.json(...)` → `project`;
everything else → `user`. Current tree: 4 `session` (web-access API keys +
`searxngHeaders`), 6 `project` (`powerline.lines`, web-access json policy
fields), ~40 `user`.

**Prompt revision (2026-09-02).** Two agents mis-read the original prompt (one
treated it as verification steps only and made no edits; one applied the
classification rule without splitting by constructor). The prompt was tightened
with an imperative framing line, an explicit "three parts, implement all three",
a closing "do not finish until all three are implemented", and a sharper
statement of rule 2. Verifier and `reference-solution.patch` unchanged.

## `extension-architecture` — case design

Both edit-task cases above ended up with their cost signal dominated by
incidental agent behaviour rather than CBM's own effect (see
[Findings](#findings)). That confound — an unfiltered `grep`/`exec_command`
hit against `.js.map` build artifacts — is fixed upstream as of felan `0.21.3`
(`@felan-ai/ext-codex@0.3.2` bundles PR #36's line-length and token-ceiling
clamp on `exec_command` output). `extension-architecture` is built to isolate
CBM's other claimed strength instead: **comprehension**, not editing. It is
read-only — explain how Felan's extension system works, write the analysis to
`EXTENSION-ARCHITECTURE.md`, touch nothing else — so there is no build and no
test run to contribute noise of its own.

**Base commit:** `e586763`, the commit tagged `0.21.3` on `felan-ai/felan@main`.
Chosen so the felan CLI version doing the exploring (`packageVersion: 0.21.3`
on both arms) matches the code being explored, and so the workspace already
carries both the `exec_command` clamp and the CBM `read_symbol` envelope fix
(`d02dcd6`). Confirmed identical to `extension-config-scope`'s `51a18d8` in
every file this case's prompt and facts touch.

**No `pnpm install`.** Unlike the other two cases, this workspace has no
`setup:` step. The task never builds or runs anything, and the two things
that could justify installing dependencies don't hold up:
`ExtensionAPI`/`InlineExtension` — the host contract from
`@earendil-works/pi-coding-agent` — never needs `node_modules` open, because
every reference to it in Felan's own source is a named type-only import
(hence the prompt's "treat the host package as a boundary" framing); and CBM
indexes git-tracked source via `gitRoot()`, not import resolution through
`node_modules`, which is gitignored anyway. Skipping it also removes a
networked install per run × 2 arms × 3 trials.

**Grading.** No build or test suite exists to grade against, so
`verifier/facts.json` is a hidden 12-fact checklist instead (see
[How grading works](#how-grading-works)): coverage catches missing areas,
and a separate citation-existence check across every `packages/…`/`apps/…`
path the report cites — independent of which facts it happens to satisfy —
catches fabricated ones. Facts are anchored on symbols and paths verified
against `e586763` directly (`packages/agent-core/src/{extensions,
extension-config,capabilities}.ts`, `apps/tui/src/{settings,dependencies}.ts`,
`packages/ext-tasks/src/index.ts`), not assumed from memory of the general
Felan architecture.

## How to run

```bash
bun run build:runtime                # once, or after a version bump
bun run list                         # sanity-check discovery

bun run run --case cbm-project-instructions \
  --agents felan-cbm-off,felan-cbm-on --concurrency 1 --attempts 3

bun run run --case cbm-extension-config-scope \
  --agents felan-cbm-off,felan-cbm-on --concurrency 1 --attempts 3

bun run run --case cbm-extension-architecture \
  --agents felan-cbm-off,felan-cbm-on --concurrency 1 --attempts 3

bun run view
```

Runs are ad-hoc `run --case … --agents …` invocations — there is no declared
`benchmarks:` entry yet. Add one (and re-run as a stamped batch) before quoting a
headline effect size; see the findings snapshot for why the current numbers
cannot resolve a 10–20% effect at n = 3.

## Findings

| Date | Doc | Summary |
| --- | --- | --- |
| 2026-09-01 / -02 | [`cbm-initial-findings.md`](./cbm-initial-findings.md) · `cbm-initial-findings.html` | First exploratory runs, both cases, n = 3/arm. Correctness a wash. Both phases' headline cost signal turned out to be an incidental agent behaviour (Phase 1: an unfiltered `grep` matching `.js.map` source maps; Phase 2: 1-second build polling), each worth more per run than CBM's own effect. Best estimate of CBM's intrinsic cost: **+11–20% on a localized task, no measurable benefit on a wide fan-out**. |

**What the initial runs changed:**

- **Felan bug report** — `ext-codebase-memory/src/services.ts`: `read_symbol`
  returns source 0 times (two envelope-parsing defects); `search_and_read_symbols`
  returns a redundant candidate list.
- **This case** — `extension-config-scope` prompt tightened (see above).
- **Harness recommendations** — cap `exec_command` output per line, enforce the
  advertised token ceiling, head-truncate greppable output, fix `yield_time_ms`
  for build commands (or exclude poll-turns from the cost metric). Details in the
  findings snapshot.
