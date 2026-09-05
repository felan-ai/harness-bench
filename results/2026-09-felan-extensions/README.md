# Felan Extension Benchmark Results — September 2026

This package presents six comparable Felan extension benchmarks. Resource
outcomes are changes from baseline; quality is the candidate aggregate pass
rate.

- [Overview](index.html)
- [Machine-readable results](results.json)
- [Flat results](results.csv)
- [Provenance manifest](manifest.json)
- [Felan README snippet](README-snippet.md)

## Results

Quality is the candidate aggregate pass rate. Positive resource results mean
the candidate used less. Headline resource gains use the ratio of
median-reduced case sums; macro-mean case gains remain diagnostics.

| Benchmark | Quality vs baseline | Cost vs baseline | Secondary result |
| --- | ---: | ---: | ---: |
| [Subagents](benchmarks/subagents/results.html) | 100% | **23.7% lower*** | — |
| [MarkItDown](benchmarks/markitdown-cost/results.html) | 100% | **31.0% lower** | 13.8% fewer prompt tokens |
| [Concise output style](benchmarks/output-style-concise/results.html) | 100% | **14.5% lower** | 16.4% fewer output tokens |
| [Prewalk](benchmarks/prewalk/results.html) | 100% | **66.0% lower** | — |
| [RTK](benchmarks/rtk/results.html) | 83.3% | **26.6% lower** | 40.6% fewer prompt tokens |
| [Codebase Memory](benchmarks/codebase-memory/results.html) | 100% | **5.8% lower†** | 6.2% shorter agent-step duration |

\* Subagents cost was [recalculated](sources/provenance/subagents-cost-recalculation.json)
by adding billed usage from all nine child sessions to their parent runs before
aggregation. The corrected candidate median is `$0.9811` versus `$1.2857` for
the baseline — **23.7% lower**. The prompt-token secondary metric remains
omitted.

† The Codebase Memory result covers 12 published attempts across two cases.

## How to read the results

- Cost and secondary outcomes use the median trial for each case, followed by
  the ratio of sums across reduced case values. Macro-mean case gains and
  ranges remain available as diagnostics.
- Quality uses the candidate aggregate pass rate.
- RTK's candidate passed 5 of 6 attempts for 83.3% quality, remaining above its
  configured floor.
- All 12 published Codebase Memory attempts passed. One candidate architecture
  attempt received verifier reward 0.8; the other rewards were 1.0.

## Included artifacts

All six comparable benchmarks include linked detail pages under `benchmarks/`;
the four framework reports also retain their JSON and CSV output there. The
Codebase Memory detail page includes JSON and CSV evidence derived from its
published two-case result.
Selected batch manifests, configuration, and recalculation evidence are under
`sources/` for auditability. Credentials, workspaces, and full transcripts are
not included.

The overview uses report-local copies of the Felan design system's canonical
tokens and logo from `../design-system`; exact source paths and hashes are in
`manifest.json`.

## Integrity

`SHA256SUMS` covers every package file except itself. Verify it from this
directory with:

```bash
shasum -a 256 -c SHA256SUMS
```

The detailed benchmark CSVs preserve their renderer's historical attempt-row
shape: attempt rows omit the final empty column. They remain standards-parseable;
the canonical top-level `results.csv` is rectangular.
