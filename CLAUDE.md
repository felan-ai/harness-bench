# CLAUDE.md — working in harness-bench

Read `README.md` for the project narrative. This repository contains Felan agent
evaluations and benchmarks built on `harness-evals`.

## Skills

When changing harness configuration, eval cases, adapters, Docker settings, or
reports, load the `harness-evals` skill first. Use the `linear` skill when work is
tied to a Linear issue.

## Scope and evaluation rules

- Keep changes focused on the requested eval, benchmark, or supporting infrastructure.
- Do not reintroduce the removed legacy benchmark. New cases must test a documented
  Felan behavior or hypothesis.
- The canonical config is `harness-evals.yaml`; cases are discovered from
  `evals/tests/**/*.yaml`.
- Keep each case self-contained with a stable fixture, prompt, and deterministic
  verifier.
- For extension experiments, compare an all-enabled arm with a variant disabling
  exactly one extension. Keep provider, model, thinking, prompt, fixture, timeout,
  attempts, concurrency, and credentials equivalent.
- Treat correctness as the primary outcome. Interpret cost or latency savings only
  when quality is non-inferior, and report the relevant supporting metrics.
- Prefer frozen/replayed external inputs for primary measurements. Put live web or
  subscription-backed runs in a separate observational track.
- Never place API keys, OAuth tokens, auth files, or ambient host configuration in
  the repository.
- Preserve unrelated local changes. Ask before changing or replacing a linked local
  dependency.

## Commands

```bash
bun install
bun run list
bun run smoke                 # requires GEMINI_API_KEY and Docker
bun run run --case <id> --agents <agent>
bun run view
```

`node_modules/harness-evals` may be a no-save symlink to a sibling development
checkout. Preserve it during dependency maintenance and verify the link after any
approved install/update.

## Layout

```text
harness-evals.yaml
 evals/tests/<family>/             cases, fixtures, and verifiers
.harness-evals/                    ignored generated runs and caches
```

The committed adapter smoke case is intentionally a plumbing check with the named
built-in extensions disabled. It is not the all-enabled baseline for extension
comparisons. Future cases should make feature settings explicit and keep their arms
comparable.
