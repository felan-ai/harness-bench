# Agent Instructions

Read and follow [`CLAUDE.md`](./CLAUDE.md) for the full repository workflow and benchmark-specific guidance.

## Evaluation architecture

Keep project defaults and reusable agent profiles in the single canonical
`harness-evals.yaml`. Use native agent `extends` for shared fields when the parent
is itself a valid runnable profile. Use concise, behavior-oriented profile names;
keep exact provider, model, and thinking settings in configuration and documentation.

Use these ownership boundaries:

```text
evals/cases/**/*.eval.yaml                 task and default agent matrix
evals/cases/<family>/<case>/verifier/      hidden grading assets
evals/fixtures/<name>/<version>/source/    immutable starting workspace
evals/fixtures/<name>/<version>/fixture.json
                                            provenance and integrity
evals/runtimes/<name>/Dockerfile           reusable tools and dependencies
```

Only files ending in `.eval.yaml` are discovered as cases. Do not add fixture
lockfiles or configuration YAML to the test glob.

## Writing a case

1. Define the behavior or hypothesis and objective success criteria first.
2. Write one `.eval.yaml` per task. A multi-arm comparison is one task multiplied
   by several named agent profiles, not duplicated case files.
3. Put the prompt, fixture reference, default `agents.include`, timeout, and
   verifier declaration in that case.
4. Keep prompts implementation-neutral and grade equivalent observable behavior.
5. Use explicit suites and stable case ids. Never silently change the meaning of
   a published case; version its fixture or create a new case when needed.
6. Keep comparison controls equivalent in prompt, fixture, verifier, attempts,
   timeout, concurrency, credentials, and runtime. Vary only the intended agent
   or feature settings.

Cases may select a smaller agent set by default. CLI `--agents` can override it
for exploratory runs without duplicating the task.

## Fixtures

- Store shared snapshots under `evals/fixtures/<name>/<version>/source`.
- The harness copies the source to a run-local writable workspace. Never directly
  mount the canonical fixture writable or let an agent edit it.
- Keep `node_modules`, build output, caches, coverage, `.env.local`, credentials,
  and other machine state out of fixtures.
- Add `fixture.json` beside `source/` with the source repository/commit or authored
  origin, exclusions, intentional benchmark changes, and relevant lock hashes.
- Reuse one fixture version across cases with the same starting state. Create a
  new version instead of mutating an established benchmark baseline.
- Fixture-local `AGENTS.md` may describe the application, commands, and constraints
  visible to evaluated agents; it must not reveal verifier expectations.

## Verifiers

- Keep verifier code outside the fixture and mount only its directory through
  `verifier.assetsDir`. Agents must not receive hidden tests or expected answers.
- Prefer deterministic behavior tests, type checks, builds, and explicit source
  invariants over implementation-specific snapshots.
- Run verifiers with `network.mode: none` whenever possible and write a binary or
  documented structured reward.
- The untouched fixture must receive reward `0`. A separately prepared known-good
  implementation must receive reward `1` before a live benchmark is trusted.
- Preserve failed and timed-out attempts in correctness, cost, token, and latency
  analysis; do not report only successful runs.

## Runtime images and workspace setup

Use the harness-managed image by default. Add a custom image only when cases need
large pinned dependencies, system packages, or a controlled toolchain.

- Scope images to a runtime/dependency profile, not an individual test. All Storzy
  cases sharing its lockfile should reuse the same Storzy runtime.
- Runtime images contain tools and immutable dependencies, not fixture source,
  prompts, verifiers, credentials, or generated run output.
- Pin base runtime and package-manager versions and install application dependencies
  from a committed frozen lockfile.
- Use `workspace.setup` argv commands to expose image-provided dependencies to the
  copied workspace before its baseline snapshot. Setup runs offline and must not
  fetch or mutate external state.
- Bump the runtime/fixture version and update integrity labels when its lockfile or
  dependency contract changes.
- Pin the Felan package in agent `config.packageVersion`; do not rely on an implicit
  latest package or couple the Felan version to an application runtime image.

## Validation and paid-run safety

For every change, run the narrowest relevant checks followed by:

```bash
bun run list
git diff --check
```

Build any referenced custom runtime and exercise its fixture setup, typecheck,
build, and verifier controls. Do not make a live provider call unless the current
request explicitly authorizes that paid run. Keep `.harness-evals/` artifacts and
result exports ignored unless a specific reviewed result is requested.

## Preserve local `harness-evals` development links

This repository may use a no-save Bun link to a sibling `harness-evals` checkout so both projects can be developed without publishing a package or changing the dependency version in `package.json`.

Before installing, updating, unlinking, or replacing dependencies:

1. Check whether `node_modules/harness-evals` is a symlink and inspect its target.
2. If a local link is active, preserve it unless the user explicitly asks to replace it.
3. Ask the user before running any command that could override or remove the local setup, including replacing it with the registry package or changing `package.json`/`bun.lock` to a local file or link dependency.
4. After an approved dependency operation, verify the resolved package and report whether the local link remains active.

The preferred untracked local setup is:

```bash
# In the sibling harness-evals checkout
bun run build
bun link

# In this repository
bun link --no-save harness-evals
```

`--no-save` is required so `package.json` and `bun.lock` keep the published semver dependency.
