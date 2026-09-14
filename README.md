# harness-bench — Felan harness comparisons

This repository contains cross-agent comparisons and adapter smoke tests for
Felan, powered by [`harness-evals`](https://www.npmjs.com/package/harness-evals).
Felan extension benchmarks are maintained with the extension source in the
Felan repository under [`evals/`](https://github.com/felan-ai/felan/tree/main/evals).

## Repository layout

```text
agent-comparison-evals.yaml       cross-agent comparison configuration
smoke-evals.yaml                  isolated Felan adapter smoke configuration
evals/cases/agent-comparison/     comparison task and verifier
evals/cases/smoke/                smoke task and verifier
evals/fixtures/felan-adapter-smoke/
evals/runtimes/felan/             shared Node, pnpm, Git, Ripgrep, RTK, and MarkItDown runtime image
```

## Commands

Requirements: Bun, Docker, Git, and credentials for any selected live agent.

```sh
bun install
bun run list:comparison
bun run list:smoke
bun run build:runtime
bun run run:comparison --benchmark codex-vs-felan-all --concurrency 1
bun run smoke
bun run view:comparison
```

Listing is offline. Comparison and smoke runs may consume paid or subscription
usage and require explicit authorization. Do not commit credentials, run
artifacts, caches, or local authentication state. Preserve the optional no-save
local `harness-evals` link.
