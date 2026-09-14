# Felan harness comparisons

This repository is limited to cross-agent comparisons and adapter smoke tests.
Felan extension benchmarks are maintained in the Felan repository under
`evals/`; do not reintroduce the removed extension suite here.

Use `bun run list:comparison`, `bun run list:smoke`, and `bun run build:runtime`.
Provider-backed runs require explicit authorization. Preserve the Bun lockfile,
optional no-save harness-evals link, shared runtime, smoke fixture, and
unrelated local changes.
