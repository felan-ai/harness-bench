# CLAUDE.md — working in harness-bench

Read `README.md` for the project narrative and `AGENTS.md` for the authoritative
evaluation-authoring and runtime conventions.

## Skills

Load the `harness-evals` skill before changing harness configuration, cases,
adapters, Docker settings, verifiers, or reports. Use the `linear` skill when
work is tied to a Linear issue.

## Scope and safety

- Keep changes focused on the requested evaluation or supporting infrastructure.
- Do not reintroduce the removed legacy benchmark.
- Preserve unrelated local changes and the optional no-save `harness-evals` link.
- Never commit API keys, OAuth tokens, auth files, local environment files,
  dependencies, generated builds, run artifacts, or caches.
- Do not start a live paid benchmark solely for offline validation; obtain clear
  authorization for the paid run.
- Treat correctness as primary. Cost or latency savings matter only when quality
  remains acceptable.

## Commands

```bash
bun run list
bun run list:smoke
bun run smoke                 # live provider call
bun run build:runtime storzy
bun run run --case prewalk-checkout --concurrency 1
bun run view
bun run run --case <id> --agents <agent>
bun run view
```

## Layout

```text
harness-evals.yaml
harness-evals.smoke.yaml
evals/cases/**/*.eval.yaml
evals/fixtures/<name>/<version>/{fixture.json,source/}
evals/runtimes/<name>/Dockerfile
.harness-evals/
```

The smoke-only and non-smoke configurations share the same local artifact and
output roots. The smoke case is a plumbing check, not an all-enabled feature
baseline. The Storzy runtime is shared by cases using the same fixture dependency
lock; it does not contain the fixture source or own the Felan version.
