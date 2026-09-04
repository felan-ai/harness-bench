# Felan Extension Benchmark Results — September 2026

This package presents five selected Felan extension benchmarks. Resource
outcomes are changes from baseline; quality is the candidate aggregate pass
rate.

- [Overview](index.html)
- [Machine-readable results](results.json)
- [Flat results](results.csv)
- [Provenance manifest](manifest.json)
- [Felan README snippet](README-snippet.md)

## Results

Quality is the candidate aggregate pass rate. Positive cost and token results
mean the candidate used fewer resources.

| Benchmark | Quality vs baseline | Cost vs baseline | Secondary result |
| --- | ---: | ---: | ---: |
| [Subagents](benchmarks/subagents/results.html) | 100% | **23.7% lower*** | — |
| [MarkItDown](benchmarks/markitdown-cost/results.html) | 100% | **31.8% lower** | 14.9% fewer prompt tokens |
| [Concise output style](benchmarks/output-style-concise/results.html) | 100% | **14.9% lower** | 16.0% fewer output tokens |
| [Prewalk](benchmarks/prewalk/results.html) | 100% | **57.6% lower** | — |
| [RTK](benchmarks/rtk/results.html) | 83.3% | **24.1% lower** | 34.4% fewer prompt tokens |

\* Subagents cost was [recalculated](sources/provenance/subagents-cost-recalculation.json)
by adding billed usage from all nine child sessions to their parent runs before
aggregation. The corrected candidate median is `$0.9811` versus `$1.2857` for
the baseline — **23.7% lower**. The prompt-token secondary metric remains
omitted.

## How to read the results

- Cost and secondary outcomes use the median trial for each case, followed by
  the macro mean of case-level percentage changes.
- Quality uses the candidate aggregate pass rate.
- RTK's candidate passed 5 of 6 attempts for 83.3% quality, remaining above its
  configured floor.

## Included artifacts

All five benchmarks include linked detail pages under `benchmarks/`; the four
unchanged framework reports also retain their JSON and CSV output there.
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
