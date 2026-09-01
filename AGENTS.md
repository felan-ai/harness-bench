# Agent Instructions

Read and follow [`CLAUDE.md`](./CLAUDE.md) for the full repository workflow and benchmark-specific guidance.

## Evaluation architecture

Keep exactly two project configurations at the repository root:

- `harness-evals.yaml` owns the non-smoke benchmark suites and profiles.
- `harness-evals.smoke.yaml` owns the isolated smoke case and profile.

Keep every agent profile self-contained. Do not use agent `extends`; repeat the
effective provider, model, thinking, timeout, auth, and adapter configuration so
reviewers can see exactly what each profile runs. Keep shared project defaults in
the two files aligned unless their intentional difference is documented. Use
concise, behavior-oriented profile names and keep exact settings in configuration
and documentation.

When a profile's defining change is disabling one extension, name it
`felan-no-<extension-name>` using the extension's kebab-case name, and use the
same value for `comparisonId`. Name enabled modes by their behavior, such as
`felan-concise`, rather than by their former inheritance hierarchy.

Every runnable profile must declare a human-readable `label` and an authored
`comparisonId`. Keep the ID stable for the same deliberate cross-batch comparison,
use distinct IDs for behaviorally different variants, and override it when a
case-level agent override changes that comparison identity. A `comparisonId` is
grouping metadata, not a configuration fingerprint.

Use these ownership boundaries:

```text
harness-evals.yaml                         non-smoke project configuration
harness-evals.smoke.yaml                   smoke-only project configuration
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
3. Put the prompt, workspace source, default `agents.include`, timeout, and
   verifier declaration in that case.
4. Keep prompts implementation-neutral and grade equivalent observable behavior.
5. Use explicit suites and stable case ids. Never silently change the meaning of
   a published case; pin a new Git commit, version its fixture, or create a new
   case when its starting source changes.
6. Keep comparison controls equivalent in prompt, starting workspace, verifier, attempts,
   timeout, concurrency, credentials, and runtime. Vary only the intended agent
   or feature settings.

Cases may select a smaller agent set by default. CLI `--agents` can override it
for exploratory runs without duplicating the task.

## Fixtures

- Prefer `workspace.git` with a credential-free public URL and full commit SHA
  when a stable public repository can own the exact starting state. Use a local
  fixture for authored or private snapshots that cannot live in such a repository.
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

Use the harness-managed image by default. Cases that need pnpm, Git, or RTK share
the single generic Felan runtime.

- Runtime images contain reusable tools and system packages, not application
  dependencies, workspace source, prompts, verifiers, credentials, or generated
  run output. Do not create lockfile-specific or case-specific images.
- Cases may use `workspace.git` to acquire an exact upstream commit on the host;
  source acquisition is not part of runtime image construction.
- Pin base runtime, package-manager, and externally installed tool versions.
- Install application dependencies during `workspace.setup` from the public npm
  registry using the committed lockfile and the package manager's frozen-lockfile
  mode. Opt the install command into `network.mode: default`; setup otherwise
  remains network-disabled. Setup runs before the baseline snapshot.
- Treat registry or setup failures as infrastructure failures, not agent-quality
  results. A lockfile change does not require a runtime image change.
- Profiles deliberately exercise the latest published Felan release. Omit
  `config.packageVersion`, refresh the managed image before a live comparison,
  and record the resolved release with the results. Keep
  `docker.pullOnRefresh: false` while the managed base is the local generic
  runtime; refresh must invalidate recipe layers without pulling that local tag.

Keep package commands and supporting scripts reusable across cases. Pass runtime,
case, suite, or agent names as arguments instead of adding one command per target.
Do not add case-specific top-level analysis, reporting, build, or test commands
or scripts unless the user explicitly requests them; use the harness's built-in
HTML, JSON, and CSV reports by default.

## Validation and paid-run safety

For every change, run the narrowest relevant checks followed by:

```bash
bun run list
bun run list:smoke
git diff --check
```

Build any referenced custom runtime and exercise its workspace setup, typecheck,
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
