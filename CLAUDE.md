# CLAUDE.md — working in harness-bench

Guidance for AI agents working in this repo. See `README.md` for the full narrative.

## What this is

`harness-bench` ports the 113-task [DeepSWE](https://github.com/datacurve-ai/deep-swe)
benchmark (Harbor format) to run under the [`harness-evals`](https://www.npmjs.com/package/harness-evals)
framework (a published npm package — a normal dependency in `package.json`). Each task is
rebuilt as a **native** per-task Docker image (`deepswe-task:<id>`) so it does not run under
amd64 QEMU emulation on Apple Silicon. `harness-evals` is consumed as-is from npm; this
project requires no changes to it.

## Commands

```bash
bun run port                              # regenerate ALL cases from third_party/deep-swe
bun run build-images --only <id>          # build native image(s) (comma-separated)
bun run build-images --all                # build all 113 (~110 GB; needs ~200 GB Docker disk)
bun run validate --only <id>              # offline reward 0/1 check, no API key
bun run validate --all --concurrency 1    # validate everything (see concurrency caveat)
bun run list                              # list discovered cases
bun run run --case <id> --agents claude-code   # run an agent (needs ANTHROPIC_API_KEY / token)
```

`--force` rebuilds an existing image; `--src <dir>` points at an alternate clone.

## Layout (one self-contained folder per task)

```
evals/<id>/<id>.yaml              the harness-evals case (image: deepswe-task:<id>)
evals/<id>/{test.sh,test.patch}   hidden verifier assets, verbatim from DeepSWE
evals/<id>/run.sh                 reward wrapper; the whole folder mounts read-only at /tests
overrides/<id>/Dockerfile         optional per-task build override (committed, auto-used)
scripts/                          port-deep-swe.ts, build-images.ts, validate-native.ts
third_party/deep-swe/             upstream clone (gitignored — clone before generating)
harness-evals.yaml                project config; case discovery glob is evals/*/*.yaml
```

## How it grades

Per-case `image: deepswe-task:<id>` is the managed-build base → the agent CLI is
layered on top. `workspace.seedFromImage` extracts `/app` (with `.git` + baked deps)
into the bind-mounted workspace so edits persist into the verifier. The verifier
mounts `evals/<id>/` at `/tests` and runs `run.sh` → DeepSWE's `test.sh`, which
applies `test.patch` and writes a `0`/`1` reward read as `verifierReward`. The
verifier runs `--network none` (tasks are air-gapped at grading).

## Rules (do / don't)

- **`evals/` is fully generated. Never hand-edit case yaml or test files.** To change
  a case, edit `scripts/port-deep-swe.ts` and re-run `bun run port` — it wipes and
  recreates all of `evals/`. Hand edits are lost on the next port.
- **Fix a task's build/environment via `overrides/<id>/Dockerfile`**, not by patching
  `third_party/` (gitignored clone, not committed). `build-images.ts` uses the override
  automatically when present. Keep it `FROM public.ecr.aws/x8v8d7g8/mars-base:latest`.
- **Build only the images you run.** `deepswe-task:<id>` is a **local-only** tag (in no
  registry); the managed build does `FROM` it without `--pull`, so a case can't run
  unless its image is built locally first. Don't `--all` casually.
- Paths (`tests:` glob, `verifier.assetsDir`) resolve relative to project root, so a
  case yaml's folder is free to move; keep `assetsDir: evals/<id>` in sync with layout.
- Scripts run directly via `bun` (no build step). After editing a script, exercise it
  (e.g. `bun run port`) to catch errors.

## Gotchas

- **VirtioFS stale cache (macOS).** After `bun run port` (which `rm -rf evals/`), Docker
  bind-mounts of the recreated folders can fail "bind source path does not exist" until
  warmed. Warm before validating/running: `docker run --rm -v "$PWD/evals/<id>:/x:ro" alpine ls /x`.
- **Validation concurrency.** `validate-native.ts` runs each task's suite twice; at
  `--concurrency >= 3` heavy suites (numba, narwhals, rust) OOM/time out and report
  **false** failures. Re-check any failure at `--concurrency 1`.
- **6 known failures are upstream drift, not bugs here.** `mars-base:latest` is a moving
  tag now shipping newer node/go/python + transitive deps than the benchmark was authored
  against, so a few baselines no longer pass: `langchain-request-coalescing`,
  `narwhals-rolling-window-suite`, `skrub-duration-encoding`,
  `fastapi-deprecation-response-headers`, `prometheus-transactional-reload-status`,
  `scriggo-method-declarations`. Fixable only by pinning versions in `overrides/<id>/`.

## Status

113/113 build natively · 107/113 validate green offline.
