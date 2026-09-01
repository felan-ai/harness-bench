# MarkItDown cost evaluation

This suite evaluates whether Felan's automatic ordinary-`read` document
conversion preserves correctness while reducing model cost, tokens, retries,
tool work, or latency.

## Controlled arms

- `felan-no-markitdown`: Felan 0.19.0 with MarkItDown disabled.
- `felan-markitdown`: the same profile with MarkItDown enabled.

Both arms use the shared `harness-bench-felan-runtime:v1`, which contains
MarkItDown 0.1.7 alongside the other common Felan benchmark dependencies. The
same document converters therefore remain installed in both arms. The profiles
differ only in MarkItDown enablement, their labels, and their comparison IDs.
All unrelated extensions are disabled, including Codex mode, so the ordinary
`read` tool is active.

The optional product baseline without an installed converter is intentionally
omitted. It would mix automatic integration value with dependency availability;
the installed-but-disabled arm isolates the requested feature with fewer arms.

## Cases

- `markitdown-docx-extraction`: cold narrative fact extraction.
- `markitdown-pptx-extraction`: cold facts across slides.
- `markitdown-xlsx-extraction`: cold tabular extraction and aggregation.
- `markitdown-warm-cache`: two ordinary reads of the same DOCX in one Felan
  session. Enabled-arm tool results should show `"cache":"miss"` followed by
  `"cache":"hit"` in the appended MarkItDown diagnostics.
- `markitdown-document-configuration`: requirements exist only in DOCX; a
  hidden, network-disabled verifier grades the resulting JSON.
- `markitdown-unused-overhead`: reads only plain Markdown to measure fixed
  capability/prompt overhead when conversion is unused.

The fixture is copied per run. Each new run therefore starts with an empty
session conversion cache. Warm-cache behavior is kept inside one agent turn
because separate harness steps launch separate Felan processes and do not share
a root-session cache.

## Metrics and interpretation

`markitdown-cost` requires three attempts per case and arm, gates both arms on a
perfect `quality.passRate`, minimizes median `cost.total`, and records duration,
prompt/input cache, output-token, and request metrics. Built-in run artifacts
also retain full tool calls and results, failed calls, retries, total tokens,
workspace changes, verifier rewards, and end-to-end duration.

Inspect correctness before cost. Keep failed, timed-out, and incomplete attempts
in the report. Compare each case separately before using the macro average:

- extraction and configuration cases show where automatic conversion helps;
- the warm-cache case distinguishes first conversion from same-session reuse;
- the unused case shows neutral behavior or fixed overhead;
- any candidate quality regression invalidates a savings claim.

The MarkItDown diagnostic already records cache hit/miss in captured tool
results. Treat a warm-cache attempt as invalid if its two captured read results
do not show an ordered miss then hit for the source DOCX, even if its answer
assertions pass. End-to-end and per-step duration come from harness-evals. No
shared instrumentation is added unless a future run demonstrates that these
existing signals are insufficient.

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
bun run run --benchmark markitdown-cost --concurrency 1
bun node_modules/harness-evals/dist/cli.js view --config harness-evals.yaml --benchmark markitdown-cost
```

Generated runs and reports stay under ignored `.harness-evals/` paths. Do not
commit them.
