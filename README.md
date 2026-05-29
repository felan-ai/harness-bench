# harness-bench — DeepSWE ported to harness-evals

The [DeepSWE](https://github.com/datacurve-ai/deep-swe) benchmark (113 long-horizon
SWE tasks across TypeScript, Python, Go, Rust, and JavaScript) ported to run under
the [`harness-evals`](https://www.npmjs.com/package/harness-evals) framework — rebuilt as **native** per-task
Docker images so tasks don't run under amd64 QEMU emulation on Apple Silicon.

> Working in this repo as an agent? See [`CLAUDE.md`](./CLAUDE.md) for the rules and gotchas.

## Prerequisites

- **[Bun](https://bun.sh)** — scripts run directly via `bun` (no build step).
- **Docker** (Desktop on macOS). A full-suite build bakes all 113 images
  (~0.8–1.1 GB unique each over a shared base) — budget a **~200 GB Docker disk**.
  Building only the tasks you run needs far less.
- The **[`harness-evals`](https://www.npmjs.com/package/harness-evals)** npm package —
  installed by `bun install` (a normal dependency in `package.json`).
- For real agent runs: the relevant credential (e.g. `ANTHROPIC_API_KEY`, or
  `CLAUDE_CODE_OAUTH_TOKEN` from `claude setup-token` on macOS).

## Layout

```
harness-evals.yaml             Project config (agents, scoring, docker baseSetup; glob evals/*/*.yaml)
scripts/port-deep-swe.ts       Converter: DeepSWE (Harbor format) -> harness-evals cases
scripts/build-images.ts        Builds native per-task images from environment/Dockerfile
scripts/validate-native.ts     Offline reward 0/1 check of native images (no agent/API key)
evals/<id>/<id>.yaml           One harness-evals case per DeepSWE task (generated)
evals/<id>/test.sh, test.patch Hidden verifier assets, copied verbatim from DeepSWE
evals/<id>/run.sh              Reward wrapper (the whole folder mounts at /tests)
overrides/<id>/Dockerfile      Optional per-task build override (committed, auto-used)
third_party/deep-swe/          Upstream clone (gitignored)
```

`evals/` is **fully generated** by `scripts/port-deep-swe.ts`; don't hand-edit it —
edit the generator (or an `overrides/<id>/Dockerfile`) and re-run the port.

## How the port works

Each DeepSWE task ships as a prebuilt Docker image with the repo checked out at
`/app`. Those prebuilt images are **linux/amd64 only**, so on an Apple-Silicon /
arm64 host they run under QEMU emulation (very slow). The fix: every task's
upstream `environment/Dockerfile` is `FROM public.ecr.aws/x8v8d7g8/mars-base:latest`,
and **mars-base is multi-arch (has an arm64 variant)**, so rebuilding each task
from that Dockerfile yields a **native** image for the host.

`scripts/build-images.ts` does exactly that, tagging each task `deepswe-task:<id>`.
The port then points each case's `image:` at that local native tag (instead of the
amd64 prebuilt). Nothing else in the pipeline changes — it relies on three
`harness-evals` capabilities:

1. **Per-case image** (`image:` in each case) — the native `deepswe-task:<id>` is the
   *base* for the managed build, so the agent CLI is layered on top of it.
2. **`workspace.seedFromImage`** — extracts `/app` (with `.git`, plus the deps baked
   by the Dockerfile) into the bind-mounted workspace so edits persist into the verifier.
3. **`verifier.assetsDir`** — mounts the task's own `evals/<id>/` folder read-only at
   `/tests` in the verifier container *only*, so the hidden tests never leak to the agent.

Because deps are baked into the per-task image (present in both the agent and
verifier containers), the verifier stays fully air-gapped with no per-language
tweaks. Grading reuses DeepSWE's own `test.sh` (run via `run.sh`), which applies
the hidden `test.patch`, runs the task tests, and writes a `0`/`1` reward that
harness-evals reads as `verifierReward`.

## Usage

```bash
# 1. Clone the upstream benchmark (once)
git clone --depth 1 https://github.com/datacurve-ai/deep-swe third_party/deep-swe

# 2. Install deps (incl. the harness-evals npm package)
bun install

# 3. (Re)generate all cases + assets
bun run port

# 4. Build the native per-task image(s). First run pulls mars-base once.
bun run build-images --only <task-id>          # one (or comma-separated)
bun run build-images --all --concurrency 4     # everything (~200 GB disk)

# 5. (Optional) Validate the native image offline — reward 0 unmodified,
#    reward 1 with the held-out solution patch. No agent / API key needed.
bun run validate --only <task-id>

# 6. List / run (needs Docker + the relevant API key, e.g. ANTHROPIC_API_KEY)
bun run list
bun run run --case <task-id> --agents claude-code
bunx harness-evals view --open
```

> **macOS gotcha:** after `bun run port` (which recreates `evals/`), warm the
> VirtioFS cache before validating/running, or bind-mounts may fail "source path
> does not exist": `docker run --rm -v "$PWD/evals/<id>:/x:ro" alpine ls /x`.

## Fidelity notes

- Task images are rebuilt from the **verbatim** upstream `environment/Dockerfile`
  (clone + per-task setup) on the native arch via the multi-arch mars-base — same
  recipe, no emulation. Each task gets its own image (sharing the mars-base layers;
  ~0.8–1.1 GB unique each — all 113 baked needs a ~200 GB Docker disk).
- **Status: 113/113 build natively, 107/113 validate green offline.**
- **Per-task overrides** (`overrides/<id>/Dockerfile`, used automatically when present)
  fix Dockerfiles that hardcode amd64-only steps:
  - `cliffy-config-file-parsing` — arch-matching deno binary (was amd64-only).
  - `eicrud-keyset-pagination-cursor` — MongoDB arm64 server tarball (no Debian arm64 apt pkg).
  - `valibot-recursive-schema-composition` — `pnpm install --ignore-scripts` (pnpm 10 build-script gate).
- **6 tasks fail validation from toolchain/dependency drift** — `mars-base:latest`
  is a moving tag and now ships newer node/go/python + transitive deps than when the
  benchmark was authored, so some baselines no longer pass: `langchain-request-coalescing`
  (langchain_core snapshot), `narwhals-rolling-window-suite` (pandas/polars numerics),
  `skrub-duration-encoding` (polars/sklearn), `fastapi-deprecation-response-headers`
  (missing `httpx2` test dep), `prometheus-transactional-reload-status` (hidden test
  pulls a go dep absent from the baked module cache), `scriggo-method-declarations`
  (go 1.25). Pin per task via `overrides/<id>/Dockerfile` to chase these.
- **Concurrency caveat:** `validate-native.ts` runs each task's full suite twice; at
  `--concurrency >= 3` heavy suites (numba, narwhals, rust) can OOM/time out and report
  false failures. Re-run any failures at `--concurrency 1` to confirm.
- Agent steps use Docker's default network; the verifier runs `--network none`
  (DeepSWE tasks are air-gapped at grading). Per-agent allowlists (as in Pier) are
  not replicated.
- `solution/` (the held-out reference) is not ported into cases; `validate-native.ts`
  uses it only to confirm the hidden tests discriminate the fix.
