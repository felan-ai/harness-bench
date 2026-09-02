# MarkItDown cost evaluation

This suite evaluates whether Felan's automatic ordinary-`read` document
conversion preserves correctness while reducing model cost, tokens, retries,
tool work, or latency.

## Controlled arms

- `felan-no-markitdown`: Felan 0.19.0 with MarkItDown disabled.
- `felan-markitdown`: the same profile with MarkItDown enabled.

Both arms use the shared `harness-bench-felan-runtime:v1`, which contains
MarkItDown 0.1.7 alongside the other common Felan benchmark dependencies. The
hashed dependency lock covers the runtime's CPython 3.13 x86_64 and aarch64
wheels. The same document converters therefore remain installed in both arms.
The profiles differ only in MarkItDown enablement, their labels, and their
comparison IDs.
All unrelated extensions are disabled, including Codex mode, so the ordinary
`read` tool is active.
This is a deliberate exception to the repository's Codex, Tasks, and Context
baseline; changing those shared tools would define a new benchmark revision.
Each case runs its document through the converter during workspace setup. A
missing or broken runtime therefore fails as infrastructure before any agent or
provider call instead of masquerading as an enabled-arm result. Enabled-arm
assertions also require the MarkItDown conversion diagnostic in the matching
`read` result, so manual fallback extraction cannot pass as extension behavior.

The optional product baseline without an installed converter is intentionally
omitted. It would mix automatic integration value with dependency availability;
the installed-but-disabled arm isolates the requested feature with fewer arms.

## Cases

- `markitdown-docx-extraction`: cold narrative fact extraction.
- `markitdown-pptx-extraction`: cold facts across slides.
- `markitdown-xlsx-extraction`: cold tabular extraction and aggregation.
- `markitdown-document-configuration`: requirements exist only in DOCX; a
  hidden, network-disabled verifier grades the resulting JSON.

The fixture is copied per run, so every conversion starts from an empty session
cache.

Build the generic runtime and invalidate the harness-managed recipe layer before
a live comparison:

```bash
bun run build:runtime
bun run run --benchmark markitdown-cost --concurrency 1 --refresh-managed-image
```

## Metrics and interpretation

`markitdown-cost` requires three attempts per case and arm, applies a `0.8`
`quality.passRate` floor, minimizes median `cost.total`, and records duration,
prompt/input cache, output-token, and request metrics. Built-in run artifacts
also retain full tool calls and results, failed calls, retries, total tokens,
workspace changes, verifier rewards, and end-to-end duration.

Inspect correctness before cost. Keep failed, timed-out, and incomplete attempts
in the report. Compare each case separately before using the macro average:

- extraction and configuration cases show where automatic conversion helps;
- any candidate quality regression invalidates a savings claim.

End-to-end and per-step duration come from harness-evals. No shared
instrumentation is added unless a future run demonstrates that these existing
signals are insufficient.

## Commands

Offline validation:

```bash
bun run build:runtime
bun run list
bun run list:smoke
```

Provider-backed execution consumes paid or subscription usage and requires
separate authorization:

```bash
bun run run --benchmark markitdown-cost --concurrency 1 --refresh-managed-image
bun node_modules/harness-evals/dist/cli.js view --config harness-evals.yaml --benchmark markitdown-cost
```

Generated runs and reports stay under ignored `.harness-evals/` paths. Do not
commit them.
