# CLAUDE.md — working in harness-bench

Guidance for AI agents working in this repo. See `README.md` for the full narrative.

## Skills

When using Pi for harness-evals work in this repo, load the harness-evals
skill before changing harness config, eval cases, adapters, Docker
settings, or reports.

## What this is

`harness-bench` ports the 113-task [DeepSWE](https://github.com/datacurve-ai/deep-swe)
benchmark (Harbor format) to run under the [`harness-evals`](https://www.npmjs.com/package/harness-evals)
framework (a published npm package — a normal dependency in `package.json`). Each task is
rebuilt as a **native** per-task Docker image (`deepswe-task:<id>`) so it does not run under
amd64 QEMU emulation on Apple Silicon. `harness-evals` is currently consumed via
`file:../harness-evals` (local checkout) because token/cost extraction in the
claude-code/codex/pi adapters is not yet published to npm — switch back to the published
version once a release ≥0.2.2 ships it.

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
  The port script tags these `suite: deep-swe-drift`, so `run --suite deep-swe`
  (107 tasks) excludes them automatically.

## Agent benchmark setup (Claude Code/Fable 5 vs Codex/GPT 5.5 vs custom pi/GPT 5.5)

- `harness-evals.pilot.yaml` is a standalone 20-task subset config; keep its `docker`
  and `agents` blocks byte-identical to `harness-evals.yaml` (managed-image cache key
  includes baseSetup + agent recipes — divergence forces a rebuild of every task image).
- harness-evals copies agent configs **independent of credentials** — auth env vars do
  NOT skip the copy; only `useCurrentConfig: false` gives a clean agent. Codex config
  excludes only work on directories, never files, hence the trimmed dir at
  `.harness-evals/agent-config/codex/` (auth.json + minimal config.toml; never commit).
- `docker.home: /tmp/agent-home` is load-bearing: managed builds run npm recipes as root
  with HOME=/home/harness, leaving a root-owned npm cache that breaks pi's runtime
  extension installs for the non-root user.
- pi runs from the frozen bench dir `~/.pi-bench/agent` (mirror of `~/.pi/agent` with
  absolute extension paths). `@howaboua/pi-codex-conversion` is vendored at
  `~/.pi-bench/vendor/pi-codex-conversion` because the npm-published linux-arm64
  `exec_bridge` needs glibc 2.39 while task images are Debian 12 (glibc 2.36) — pi
  crashes with an unhandled EPIPE on its first shell command. The vendored copy's
  bridge is rebuilt from the package's bundled Rust sources
  (`cargo build --release --locked -p codex-exec-shim --bin exec_bridge` in
  `rust:1-bookworm`). Refresh auth/settings there when the real pi config changes.
- Auth pre-flight per session: `CLAUDE_CODE_OAUTH_TOKEN` in `.env` (from
  `claude setup-token`); re-copy `~/.codex/auth.json` and `~/.pi/agent/auth.json` into
  their bench locations if stale. Codex ChatGPT-OAuth is fragile under the harness:
  refresh tokens are single-use and rotate inside throwaway per-run config copies, so
  a mid-sweep refresh 401-cascades all later codex runs AND stales `~/.codex` (re-login
  needed). API-key auth avoids this entirely.
- Tokens + cost per run are collected by the adapters (DeepSWE-leaderboard-style
  metrics) and rendered in the harness HTML/CSV report. The claude-code/codex adapters
  default to machine-readable output (`--output-format json` / `--json`) when running
  the real CLIs — `outputFormat: text` opts out; pi reports usage natively from its
  event stream. Codex reports tokens only (no $ pricing under ChatGPT auth); claude/pi
  report list-price USD even on subscription auth.

## Status

113/113 build natively · 107/113 validate green offline.
