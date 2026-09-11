# Codex versus Felan

This benchmark compares the official Codex CLI with Felan's full built-in
extension surface on `codex-vs-felan-checkout`, cloned from the existing
`prewalk/checkout` task.

## Task and controls

The task is a non-trivial authenticated Storzy checkout implementation. It
requires coordinated login, route guards, cart persistence, failure recovery,
duplicate-submit prevention, receipt rendering, API compatibility, both checkout
variants, and feature-flag preservation. The hidden verifier runs type checking,
both checkout builds, and the API/UI test suite against the final workspace.

Both arms use the same Storzy commit, prompt, setup, runtime image, workspace,
verifier, 30-minute timeout, and three trials. The workspace is mounted at
`/home/dev/storzy` because Codebase Memory rejects a project root named
`/workspace`.

- `codex-clean` is the baseline. It uses Codex CLI with `gpt-5.6-sol`, max
  reasoning, priority service, low verbosity, copied authentication, and
  `--ignore-user-config --ignore-rules --ephemeral` so ambient instructions and
  persisted sessions do not affect the run.
- `felan-all-extensions` is the candidate. It uses Felan's OpenAI Codex OAuth
  model with the same max thinking level. It relies on Felan's default of
  enabling every registered built-in rather than overriding `builtinExtensions`.
  It uses concise output, curated Codebase Memory, RTK rewriting, headless-safe
  Prewalk, and low-tier session compaction. Felan settings are generated with
  `useCurrentConfig: false`; no package version is pinned so the run exercises
  the latest published release.

All built-ins are enabled as a deliberate full-surface comparison. Some are
passive unless configured or called: Felan API and MCP have no credentials or
servers here, web access is not required by the task, and the shared runtime
does not preinstall a Chrome binary for Browser. These differences are
reported as profile/runtime context, not treated as task failures.

The benchmark maximizes `quality.passRate` first and minimizes agent-step
duration second. Dollar cost is not an objective because Codex ChatGPT auth
does not report provider cost; token and request metrics remain in the reports.
Record the resolved Felan and Codex CLI versions with any published results.

## Offline controls

The verifier assets are cloned from `prewalk/checkout` and mounted only into the
verifier. `reference-solution.patch` was generated from the validated good
Storzy workspace and is an offline control only; it is not applied during live
grading. The untouched commit must produce reward `0`; applying the reference
patch must produce reward `1`. Generated `.next` output and
`tsconfig.tsbuildinfo` are excluded from workspace capture. Neither control
invokes a model.

## Run

```bash
bun run list:comparison
bun node_modules/harness-evals/dist/cli.js list \
  --config agent-comparison-evals.yaml --benchmark codex-vs-felan-all

# Provider-backed; requires explicit authorization and local auth.
bun run run:comparison --benchmark codex-vs-felan-all --concurrency 1 --refresh-managed-image
bun node_modules/harness-evals/dist/cli.js view \
  --config agent-comparison-evals.yaml --benchmark codex-vs-felan-all --no-open
```

Use `--cleanup` for runs where adapter config snapshots should be removed after
completion. Do not commit credentials, run artifacts, or generated reports.
