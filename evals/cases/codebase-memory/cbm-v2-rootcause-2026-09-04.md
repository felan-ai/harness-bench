# Codebase Memory root-cause report — 2026-09-04 v2 batch

Scope: offline analysis only. No new paid/provider runs. Data came from batch `.harness-evals/batches/20260904-124556-6ffe.json` and its 18 run directories, excluding the earlier standalone pre-flight `cbm-extension-architecture-felan-cbm-on-2026-09-04T12-36-51-033Z-0`.

Important caveat: this is a within-batch off/on analysis, not a raw old-vs-new magnitude comparison. The case prompts and two verifiers changed between the prior report and this batch, so cost/token differences against the previous batch are confounded by task shape. Old-batch numbers are used only as mechanism reference points.

## Executive conclusion

Felan 0.21.11 / CBM 0.1.7 fixed the biggest old `search_and_read_symbols` bug only partially.

- Resolved: every observed `search_and_read_symbols` result now uses the compact top-level shape. `total_candidates`, `read_candidates`, and `omitted_candidates` are present in 32/32 calls; the old full top-level `candidates` array appears in 0/32.
- Not fully resolved: the result still includes `symbols[].symbol` beside each `symbols[].snippet`. In this batch that remaining metadata accounts for 65,578 B, 17.5% of all `search_and_read_symbols` payload.
- Changed: grep augmentation is no longer a major payload source. It appears only 7 times in the new CBM-on arms, versus 42 augmented `exec_command` results in the prior report.
- Still true: CBM-on can induce wider exploration and more requests. Architecture is still more expensive with CBM-on despite compact search results. Config-scope now wins because CBM-on reduced ordinary raw `exec_command` payload/carry, not because it used many compact symbol searches.

## Batch outcome

Median usage by case:

| case | arm | reward | cost | step s | prompt tokens | uncached input | cache-read input | output | requests |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| extension-architecture | off | 1 | $1.201 | 365.3 | 828,316 | 123,914 | 712,064 | 8,591 | 13 |
| extension-architecture | on | 1 | $1.418 | 361.0 | 903,285 | 162,165 | 741,120 | 8,348 | 17 |
| extension-config-scope | off | 1 | $3.107 | 875.7 | 4,188,849 | 124,750 | 4,073,984 | 15,520 | 65 |
| extension-config-scope | on | 1 | $2.639 | 802.5 | 3,150,464 | 127,872 | 3,022,592 | 14,671 | 71 |
| project-instructions | off | 1 | $0.967 | 353.4 | 884,884 | 67,220 | 817,664 | 7,400 | 21 |
| project-instructions | on | 1 | $0.944 | 382.7 | 925,379 | 62,034 | 866,176 | 7,579 | 28 |

Within-batch deltas:

| case | cost delta | step delta | request delta | quality note |
| --- | ---: | ---: | ---: | --- |
| extension-architecture | +18.0% | -1.2% | 13 → 17 | CBM-on had one 0.8 reward from missed loose fact `tool-to-model-path`; all other runs scored 1. |
| extension-config-scope | -15.0% | -8.4% | 65 → 71 | All 6/6 passed with reward 1. |
| project-instructions | -2.4% | +8.3% | 21 → 28 | All 6/6 passed with reward 1. |

## Method

For each run I parsed `steps/run/stdout.log`, `steps/run/cost.json`, `steps/run/step-completed.json`, and verifier reward output.

- Billing totals use `steps/run/cost.json`.
- Request counts use the cost report and assistant `message.usage` records.
- Tool result payload bytes sum text blocks in `tool_execution_end.result.content[]`.
- Carry estimate is `payload_bytes / 4 × requests_remaining`, using the request index of the assistant turn that emitted the tool call.
- `tool_execution_start`/`tool_execution_end` records in these stdout exports do not carry per-tool timestamps, so exact per-tool wall duration cannot be joined from the exported event stream. Step duration and embedded command `Wall time:` strings were used only qualitatively.

## #40 verification: compact `search_and_read_symbols`

Observed CBM-on `search_and_read_symbols` calls:

| case | calls | compact top-level | old top-level `candidates` | payload bytes | carry token est. |
| --- | ---: | ---: | ---: | ---: | ---: |
| extension-architecture | 26 | 26 | 0 | 311,374 | 808,900 |
| extension-config-scope | 2 | 2 | 0 | 16,011 | 250,072 |
| project-instructions | 4 | 4 | 0 | 47,064 | 233,320 |
| **total** | **32** | **32/32 (100%)** | **0/32** | **374,449** | **1,292,292** |

The shape is compact at the top level, but not snippet-only:

- Total candidates reported: 491.
- Read candidates: 240.
- Omitted candidates: 251.
- Every non-empty result still has `symbols[].symbol` plus `symbols[].snippet`.
- Removing `symbols[].symbol` from these observed results would reduce `search_and_read_symbols` payload from 374,449 B to 308,871 B, saving 65,578 B / 17.5% before carry.

Comparison to the prior report:

- Prior report measured all explicit CBM tool payload, not only `search_and_read_symbols`: 92 calls, 264,706 B, ~960k carried-token-equivalents.
- This batch has 32 `search_and_read_symbols` calls alone with 374,449 B and ~1.29M carry. This does **not** mean #40 regressed; prompts changed and architecture used many more/higher-read-limit symbol searches.
- Mechanism conclusion: #40 removed the old full top-level candidate array, but remaining source payload size and per-read symbol metadata are now the dominant `search_and_read_symbols` costs.

## Updated CBM payload attribution

CBM-on direct tool payload and grep augmentation:

| case | direct CBM calls | direct CBM bytes | direct CBM carry est. | `read_symbol` bytes/carry | `search_and_read_symbols` bytes/carry | `search_code` bytes/carry | `codebase_memory` bytes/carry | grep augment calls bytes/carry hits/empty |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| extension-architecture | 135 | 616,553 | 1,524,287 | 196,808 / 413,309 | 311,374 / 808,900 | 98,510 / 265,921 | 9,861 / 36,157 | 1 · 9,340 / 23,350 · 1/0 |
| extension-config-scope | 14 | 31,999 | 529,492 | 7,072 / 123,801 | 16,011 / 250,072 | 1,381 / 21,176 | 7,535 / 134,444 | 0 |
| project-instructions | 25 | 83,352 | 416,689 | 20,510 / 92,747 | 47,064 / 233,320 | 2,749 / 12,510 | 13,029 / 78,112 | 6 · 2,076 / 9,491 · 3/3 |

Ordinary `exec_command` payload/carry remains larger than direct CBM in config-scope and project-instructions:

| case | arm | tool calls | `exec_command` bytes | `exec_command` carry est. | `write_stdin` calls | `apply_patch` calls |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| extension-architecture | off | 107 | 1,423,907 | 2,407,663 | 0 | 2 |
| extension-architecture | on | 217 | 419,469 | 825,394 | 0 | 3 |
| extension-config-scope | off | 254 | 759,268 | 8,852,848 | 71 | 21 |
| extension-config-scope | on | 228 | 493,532 | 5,660,161 | 78 | 24 |
| project-instructions | off | 104 | 512,523 | 1,605,400 | 8 | 4 |
| project-instructions | on | 132 | 352,240 | 1,553,409 | 8 | 6 |

Interpretation:

- Architecture: CBM-on reduced raw file-dump payload but replaced it with many direct CBM calls and more requests. It still lost on cost.
- Config-scope: CBM-on barely used `search_and_read_symbols` but reduced raw command output/carry enough to win cost and step time.
- Project-instructions: CBM-on has a small cost win but more requests and slower median step duration.

## Other fixes: #34, #37, #31

| prior issue | status in this batch | evidence |
| --- | --- | --- |
| #34 `read_symbol` both-shapes parser failure | Resolved as a parser bug; ordinary misses remain. | Successful `read_symbol` calls returned source snippets: architecture 50, config-scope 4, project-instructions 6. There were 13 no-match outputs, but they were explicit lookup misses such as `"error": "No matching symbol found"`, not source-less successes. |
| #37 stale-refresh guard | No failure signature observed; benchmark coverage is weak. | No on-arm transcript showed stale-index state causing wrong code reads or wrong answers. The cases do not strongly exercise post-edit reindexing. |
| #31 auto-index path validation | No failure signature observed. | No on-arm transcript showed unsafe auto-index path behavior or explicit `index_repository` use. Current 0.1.7 source validates automatic roots before indexing/querying in `packages/ext-codebase-memory/src/services.ts:40-49` and `:101-123`, and gates query tools in `tools.ts:47-56` and `:129-138`. Explicit `index_repository` still accepts `repo_path` in `tools.ts:43-45`, so that path should remain treated as user-approved explicit indexing. |

Source caveat: the run workspaces themselves still show older package versions in `workspace/packages/ext-codebase-memory/package.json` for the benchmark source repositories: architecture 0.1.5 and config-scope 0.1.2. The runtime behavior in transcripts is nevertheless the 0.1.7 compact behavior. File:line references above and below are from the current sibling Felan source at `/Users/yavorboychev/Projects/FelanAI/felan/packages/ext-codebase-memory/src/`, version 0.1.7.

## Case-by-case update vs prior report

### extension-architecture

Prior report: CBM-on lost, +16.1% median cost and +27.3% median step duration. Main mechanism was over-fetch/duplication plus extra navigation.

This batch: CBM-on still loses on cost: off $1.201 vs on $1.418 (+18.0%). Step duration is effectively tied/slightly better for CBM-on: 365.3 s vs 361.0 s (-1.2%). CBM-on made many more direct CBM calls: 135 total, including 26 `search_and_read_symbols` and 59 `read_symbol` calls.

Mechanism now: not the old top-level `candidates` array. The loss is mostly exploration breadth and remaining source payload:

- `search_and_read_symbols`: 311,374 B / ~808,900 carry.
- `read_symbol`: 196,808 B / ~413,309 carry.
- Median requests: off 13, on 17.

The one 0.8 CBM-on reward missed verifier fact `tool-to-model-path`. The generated report did discuss tools and model-facing capability guidance, but apparently did not co-locate the exact “registered tool reaches the model through the host/session” phrasing inside the verifier window. Treat this as an explicitness/report-phrasing miss, not evidence that CBM retrieved wrong architecture facts.

### extension-config-scope

Prior report: wash, CBM-on +8.2% cost and +9.4% latency.

This batch: CBM-on wins: off $3.107 vs on $2.639 (-15.0%), and 875.7 s vs 802.5 s (-8.4%). All six runs passed with reward 1.

Mechanism: not primarily #40. There were only two `search_and_read_symbols` calls in all three CBM-on runs. The strongest measurable difference is reduced ordinary raw command output/carry:

- off `exec_command`: 759,268 B / ~8.85M carry.
- on `exec_command`: 493,532 B / ~5.66M carry.
- direct CBM payload in on: only 31,999 B, though carried for ~529k due many later requests.

CBM likely helped navigation enough to avoid some raw file dumping and retry work. The result is a real within-batch CBM win, but not direct evidence that compact `search_and_read_symbols` caused the win.

### project-instructions

Prior report: CBM-on cost lower (-11.5%) but much slower (+65.2%).

This batch: same direction but smaller. CBM-on cost is $0.944 vs off $0.967 (-2.4%), while step duration is 382.7 s vs 353.4 s (+8.3%). All six runs passed.

Mechanism: CBM-on still increases request count (21 → 28) and adds direct CBM payload (83,352 B / ~416,689 carry). Raw command output/carry is similar between arms and includes large host-package searches. The old latency gap largely shrank, but request inflation remains.

## Prior finding → status

| prior finding | status | v2 read |
| --- | --- | --- |
| Fixed CBM preamble is real but small | Still true, but noisier to isolate due prompt/session variation. | It is not the main cost driver in any case. |
| Direct CBM payload is the largest extension-owned lever | Still true, changed shape. | Top-level candidate over-fetch is fixed; source snippets, `symbols[].symbol`, and high read limits now dominate. |
| `search_and_read_symbols` over-fetched and duplicated candidate arrays | Partly resolved. | Full top-level `candidates` array is gone in 32/32 calls; per-read `symbols[].symbol` remains. |
| Grep augmentation was noisy and often empty | Mostly resolved in volume. | Only 7 augmented results; 11,416 B total. Current 0.1.7 gating reduced it from a major to minor driver. |
| Latency not primarily index build wall-clock | Still true from available evidence. | No start-blocking/index wait signature explains the remaining deltas; step differences track exploration/request patterns more than indexing. |
| `read_symbol` parser defects shifted/fixed | Still resolved as parser issue. | No source-less successful reads observed; only normal no-match misses. |
| CBM can encourage extra navigation | Still true. | CBM-on had higher median requests in all three cases: +4, +6, +7. |

## New/remaining bugs and optimization opportunities

Ranked by expected impact from this batch:

1. **Make `search_and_read_symbols` snippet-only or much leaner.** Current 0.1.7 returns `symbols` as `{ symbol, snippet }` in `packages/ext-codebase-memory/src/services.ts:206-215`. The observed remaining `symbols[].symbol` metadata costs 65,578 B / 17.5% of `search_and_read_symbols` payload before carry.
2. **Lower default symbol-read size and discourage high read limits.** `max_symbol_lines` defaults to 220 for `read_symbol`, `search_and_read_symbols`, and `search_code` in `tools.ts:80-107` and `:120-128`. In this batch, architecture left `read_symbol` default on 58/59 reads and left `search_and_read_symbols` default line bounds on 26/26 calls; many calls requested `read_limit` 8-12. A lower default plus explicit “increase only when needed” guidance would target the largest current CBM payload driver.
3. **Tune `search_and_read_symbols` defaults.** The allowed `read_limit` range is 1-12 and default is 6 (`tools.ts:102-107`, `services.ts:200-215`). Architecture often asked for 8, 10, or 12. Consider stricter default/result budgeting, especially for report-writing tasks.
4. **Improve `search_code` query guidance and result shaping.** Explicit on-arm `search_code` had 16 zero-result outputs out of 60 calls. Some calls used broad limits/context or low-value patterns. `tools.ts:120-128` still allows high default `limit`, `context`, and `max_symbol_lines`; better empty-query warnings and examples could reduce wasted calls.
5. **Keep grep augmentation gated; reduce its line bound too.** The gating in `grep-augmentation.ts:27-37` worked, but augmentation still calls `search_code` with `max_symbol_lines: 220` at `grep-augmentation.ts:43-49`. It is low volume now, but if hit rate rises this can become expensive again.
6. **Monitor request-count inflation.** CBM-on increased median requests in all cases. This is not a single source-line bug, but it is now the clearest cross-case behavioral cost driver after #40.
7. **Verifier/report phrasing gap for architecture.** The 0.8 architecture on-arm missed `tool-to-model-path` even though the report discussed tools and model-facing guidance. Either prompt/report guidance should encourage explicit host-to-model tool path phrasing, or the loose verifier window should be reviewed before interpreting a single 0.8 as quality loss.

### Focused next implementation direction

Start with the smallest extension change that directly follows from the measured v2 driver: return snippet-oriented `search_and_read_symbols` results by dropping `symbols[].symbol` or replacing it with only non-duplicative locator fields needed to cite the snippet. This is lower risk than changing search behavior, prompt policy, or verifier expectations, and it has a measured upper-bound saving of 65,578 B / 17.5% on the observed `search_and_read_symbols` payload before carry. After that lands, reduce default symbol read size/read limits and rerun the same batch only if a paid run is explicitly authorized.

## Bottom line

0.1.7 fixed the old full-candidate-array mechanism, and config-scope now shows a strong within-batch CBM win. But CBM-on is not broadly cheaper yet. The next work should target remaining symbol/snippet payload size and request-count behavior, not another grep-augmentation patch or another paid rerun.
