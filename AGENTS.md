# Felan harness comparisons

This repository owns cross-agent comparisons and the isolated Felan adapter
smoke evaluation. Felan extension benchmarks live in the Felan repository under
`evals/`.

- `agent-comparison-evals.yaml` owns harness comparisons.
- `smoke-evals.yaml` owns the adapter smoke case.
- `evals/cases/agent-comparison/` and `evals/cases/smoke/` hold their cases.
- `evals/runtimes/` holds the shared runtime used by those cases.

Use the Bun project commands in `package.json`. Preserve the local no-save
`harness-evals` link when maintaining dependencies. Offline listing is safe;
comparison and smoke runs may use paid providers and require explicit
authorization. Do not commit credentials, run artifacts, caches, or local state.
