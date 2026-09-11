# Codebase Memory model surfaces — three cases, four arms

Offline analysis of three separately invoked batches. No provider calls were made
to produce this document; all figures are recomputed from retained run artifacts
under `.harness-evals/`.

| Case | Batch | Runs | Date (UTC) |
| --- | --- | ---: | --- |
| `cbm-extension-architecture` | `20260908-090907-5a66` | 12 | 2026-09-08 |
| `cbm-extension-config-scope` | `20260908-114759-951e` | 12 | 2026-09-08 |
| `cbm-project-instructions` | `20260909-123711-ff11` | 12 | 2026-09-09 |

Four arms per case — `off`, `curated`, `direct`, `single-proxy` — three trials
each, `--concurrency 1`, arms run in blocks in that order. 36 runs total.

## Parity

All 36 runs report Felan **0.23.2**, `@felan-ai/ext-codebase-memory` **0.3.1**,
`codebase-memory-mcp` **0.10.8**, provider `openai-codex`, model `gpt-5.6-sol`,
thinking `medium`. Archived settings are identical after removing the intended
`builtinExtensions.codebaseMemory` and `extensionConfig.codebaseMemory.mode`
fields. Case prompts hash-match the v2 batch: architecture
`82d11f33467894dc…`, config-scope `29694c9ba0680fa2…`.

Every run passed its verifier. Architecture uses a graded reward
(`matched / 5` facts, `failBelow` 0.6); the other two are binary.

## Results

### Per case, per arm

Medians over three trials, with the full trial list where spread matters.

**`extension-architecture`** — read-only comprehension, graded reward

| arm | reward (all) | cost med | cost mean | step med | req med | prompt med | out med |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| off | 0.80 (0.8, 0.8, 1.0) | $1.200 | $1.339 | 234s | 15 | 946,059 | 8,562 |
| curated | **1.00 (1.0, 1.0, 1.0)** | $1.213 | $1.269 | 244s | 17 | 883,334 | 9,640 |
| direct | **1.00 (1.0, 1.0, 1.0)** | $1.256 | $1.292 | **223s** | 17 | 1,008,861 | 8,481 |
| single-proxy | 0.80 (0.6, 0.8, 0.8) | **$1.036** | $1.230 | 248s | 14 | 790,573 | 8,707 |

**`extension-config-scope`** — cross-package refactor, binary reward

| arm | reward | cost med | cost mean | step med | req med | prompt med | out med |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| off | 1.0 (3/3) | $3.895 | $3.847 | 728s | 80 | 5,717,681 | 14,226 |
| curated | 1.0 (3/3) | $2.243 | $2.408 | 666s | 41 | 2,778,403 | 14,359 |
| direct | 1.0 (3/3) | **$2.216** | $2.586 | **613s** | 43 | 2,684,119 | 12,771 |
| single-proxy | 1.0 (3/3) | $2.875 | $3.195 | 710s | 66 | 3,973,768 | 15,445 |

**`project-instructions`** — localized regression fix, binary reward

| arm | reward | cost med | cost mean | step med | req med | prompt med | out med |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| off | 1.0 (3/3) | **$0.632** | $0.696 | 206s | 15 | 452,874 | 6,099 |
| curated | 1.0 (3/3) | $0.680 | $0.731 | 166s | 20 | 549,560 | 6,015 |
| direct | 1.0 (3/3) | $0.696 | **$0.699** | 178s | 21 | 530,559 | 7,617 |
| single-proxy | 1.0 (3/3) | $0.741 | $0.700 | **164s** | 19 | 620,480 | 6,698 |

### Aggregate rollups

Replicating the declared estimator — `aggregation.trials: median`,
`aggregation.cases: ratioOfReducedSums`, gate `quality.passRate >= 0.8`.

| benchmark | cost.total | change | duration.stepsMs | change | passRate | gate |
| --- | --- | ---: | --- | ---: | ---: | --- |
| `codebase-memory` (curated) | $5.727 → $4.136 | **−27.8%** | 1167s → 1077s | −7.8% | 1.00 | PASS |
| `codebase-memory-direct` | $5.727 → $4.168 | −27.2% | 1167s → 1013s | **−13.2%** | 1.00 | PASS |
| `codebase-memory-single-proxy` | $5.727 → $4.652 | −18.8% | 1167s → 1123s | −3.8% | 1.00 | PASS |

**The aggregate is one case.** `ratioOfReducedSums` sums absolute per-case
medians, so weighting follows spend:

| case | baseline median | share of baseline sum |
| --- | ---: | ---: |
| `extension-config-scope` | $3.895 | **68%** |
| `extension-architecture` | $1.200 | 21% |
| `project-instructions` | $0.632 | 11% |

Remove config-scope and every enabled surface is neutral-to-worse on cost. The
−27.8% headline is a property of the study's weighting, not a per-task
expectation.

## Mechanism

### Tool surface cost

First-request input tokens against the `off` arm, measured on all three cases
independently and identical in each:

| mode | schema overhead | tools registered |
| --- | ---: | ---: |
| `single-proxy` | **+368 tok** | 1 |
| `curated` | **+508 tok** | 4 |
| `direct` | **+2,476 tok** | 12 |

Proxy's overhead grew from +131 in the 2026-09-05 batch because 0.3.1 renders
the per-command field list into the tool description (~246 tokens). Direct's
schema is ~6.7× proxy's and rides every request — at architecture's 17 median
requests that is ~42k prompt tokens of pure schema.

### What each surface actually did

CBM calls across all three trials per case, classified by outcome:

| case | arm | calls | useful | empty/no-match | schema error | CBM payload |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| architecture | curated | 72 | 67 | 5 | 0 | 412 kB |
| architecture | direct | 135 | 135 | 0 | 0 | 857 kB |
| architecture | single-proxy | 9 | 4 | 0 | **5** | 8 kB |
| config-scope | curated | 15 | 12 | 3 | 0 | 40 kB |
| config-scope | direct | 39 | 39 | 0 | 0 | 162 kB |
| config-scope | single-proxy | 8 | 4 | 0 | **4** | 3 kB |
| project-instructions | curated | 32 | 24 | 8 | 0 | 84 kB |
| project-instructions | direct | 29 | 28 | 1 | 0 | 71 kB |
| project-instructions | single-proxy | 7 | 2 | 0 | **5** | 5 kB |

Direct makes the most calls and essentially never misses. Curated misses
5–25% depending on case. Proxy barely calls at all, and most calls fail.

### The proxy surface is still broken, differently

Across all three cases: **24 `codebase_memory` calls, 14 failures (58%)**.
0.3.1 fixed the failure mode observed on 2026-09-05 — the model now gets field
*names* right — and exposed the next one.

| failure class | count | example |
| --- | ---: | --- |
| invalid enum value on a correctly-named field | **12** | `detail: "full"` (allowed `ids\|default`); `format: "summary"` (allowed `tree\|json`); `aspects: ["modules","data_flow"]` (neither is in the literal list) |
| explicit `project` rejected by the host | 2 | `index_status` with `project: "felan"` → *"queries must use the active project; omit project"* |

Both classes trace to `describeRawCommands()` (`raw-catalog.ts`):

1. It emits field **names** but not their **allowed values**, so a constrained
   field looks free-form.
2. It advertises `project?` as an optional field on every scoped command, but
   `dispatchRawCommand` rejects any explicit `project` that differs from the
   resolved one — which the model cannot know. The description actively
   instructs the model toward a call that can never succeed.

Compounding both: the rejection text still ends `Unknown fields are not
allowed` even when the field name was accepted and only its value was invalid.
The message misdirects the retry. In two runs the model retried the same
invalid enum, then abandoned CBM entirely.

Proxy's cost numbers should therefore be read as *"off, plus 368 tokens of
schema the agent could not use"* — not as a measurement of a proxy surface.

### Where config-scope's difference actually comes from

Config-scope supplies 68% of the aggregate, so its mechanism decides the
headline. It is **not** retrieval.

Across all 12 config-scope runs:

- cost vs **requests**: Pearson **r = 0.938**
- cost vs **`write_stdin` build polls**: Pearson **r = 0.842**
- cost vs CBM payload bytes: no meaningful relationship (curated's cheapest run
  used 4 kB of CBM; its most expensive used 20 kB)

Poll counts per run: off `29, 58, 46`; curated `36, 1, 7`; direct `37, 4, 9`;
single-proxy `54, 29, 24`. The agent chooses `yield_time_ms` per command; a
1-second yield on a multi-minute `pnpm build` turns one command into dozens of
billed requests. Every arm has at least one high-poll run, and every arm's most
expensive run is its highest-polling run.

The `off` arm drew three high-poll runs and the CBM arms mostly did not. With
n=3 that is well within chance. **The config-scope result — and therefore the
aggregate — is substantially a polling artifact, not demonstrated retrieval
value.**

### Where project-instructions' difference comes from

This case has **zero `write_stdin` calls in all 12 runs**, so the polling
confound is absent. It is the cleanest signal in the batch.

All three enabled surfaces are *slower to nothing* on cost (+0.4% to +7.6% on
mean) but **faster in wall time**: 164–178s versus off's 206s, a 14–20%
reduction, while using *more* requests (19–21 vs 15). Cost per request is lower
for every enabled arm.

This inverts the v1 finding on the same case (+65% latency with CBM on). The
mechanism visible in transcripts: enabled arms replace large `exec_command`
file dumps with smaller targeted reads — `exec_command` payload drops from
126–150 kB (off) to 83–99 kB (direct) — producing more, cheaper turns rather
than fewer expensive ones. Whether that is worth a small cost premium is a
judgement this data does not settle.

### Where architecture's difference comes from

Architecture is the only case with quality variance, and it favours the
enabled surfaces:

- `curated` and `direct`: **3/3 runs at reward 1.0** (5/5 facts)
- `off`: 0.8, 0.8, 1.0 — two runs missed one fact
- `single-proxy`: 0.6, 0.8, 0.8 — the weakest arm

All 12 runs pass the gate, because `failBelow` is 0.6 and the gate is
`passRate`. The quality difference is invisible to the benchmark's own gate and
only appears in the raw reward.

Cost is a wash (medians $1.04–$1.26, means $1.23–$1.34, spread within arms
larger than between them). Direct spends 857 kB on CBM payload while dropping
`exec_command` output to 27–119 kB from off's 381–615 kB — a near-total
substitution of graph retrieval for shell reading, at neutral cost and better
fact coverage.

## Comparison with prior reports

Prior analyses: [v1](./cbm-v1-rootcause-2026-09-04.md) (first stamped batches,
original descriptive prompts) and [v2](./cbm-v2-rootcause-2026-09-04.md) (first
batch on the behavioural prompts and the loose five-fact verifier).

| case | v1 (0.21.3, descriptive prompts) | v2 (0.21.11, behavioural prompts) | this batch (0.23.2) |
| --- | --- | --- | --- |
| architecture | on lost, +16.1% cost | on lost, +18.0% cost | cost a wash; **quality favours curated/direct** |
| config-scope | on lost, +8.2% cost | on won, −15.0% cost | on wins on cost, but tracks polling (r=0.842) |
| project-instructions | −11.5% cost, **+65% latency** | −2.4% cost, +8.3% latency | +0.4…+7.6% cost, **−14…−20% latency** |

Absolute values are not comparable across rows: Felan moved 0.21.3 → 0.21.11 →
0.23.2, and the case definitions changed between v1 and v2. Only the
within-batch off-versus-on direction carries across.

## What could be improved — the extension

1. **Emit allowed values, not just field names** (`describeRawCommands`).
   Twelve of fourteen proxy failures were valid field names carrying invalid
   enum values. Rendering `detail(ids|default)` instead of `detail?` addresses
   the entire class at a cost of roughly 80–120 further tokens.
2. **Stop advertising `project?`.** It is host-injected and any explicit value
   is rejected. It should be omitted from the rendered description entirely.
3. **Report the actual validation failure.** `Unknown fields are not allowed`
   is wrong for a value/type error and sends the retry in the wrong direction.
   Emitting the offending field and why it failed would let attempt two succeed.
4. **Document curated's two path parameters.** `search_code` accepts both
   `file_pattern` (a `grep --include` basename glob) and `path_filter` (a path
   regex) with no descriptions on the curated schema. In the 2026-09-05 batch
   `file_pattern` alone was empty 64% of the time versus 11% for `path_filter`.
5. **Lower `max_symbol_lines`' default.** It defaults to 220, its own maximum,
   while `search_and_read_symbols` sensibly defaults to 120.
6. **Reconsider hiding traversal behind the untyped bag.** `trace_path`,
   `query_graph` and `detect_changes` are reachable in curated only through
   `codebase_memory`'s untyped `arguments`. Curated used zero traversal calls in
   six runs on 2026-09-05; direct, with typed schemas, reached `trace_path`.
   Graph traversal is the extension's differentiating claim and the surface
   most likely to be exercised is the one that hides it.

## What could be improved — the benchmark

1. **Control `yield_time_ms`, or exclude poll turns from cost.** It is the
   single largest cost lever in config-scope (r = 0.842) and it is an agent
   behaviour, not an extension property. Until it is controlled, config-scope
   cannot cleanly measure retrieval — and it carries 68% of the aggregate.
2. **Interleave arms instead of blocking them.** All three `off` trials run
   first, then curated, direct, proxy. Provider-side drift over a 60–150 minute
   window is fully confounded with arm.
3. **Raise n above 3.** Within-arm spread exceeds most between-arm deltas;
   median and mean disagree in direction on config-scope and
   project-instructions. Nothing here is statistically established.
4. **Gate on reward, not `passRate`, where reward is graded.** Architecture's
   gate is at ceiling — 12/12 pass — while the underlying reward separates the
   arms. The benchmark cannot currently see its own clearest quality signal.
5. **Weight the aggregate deliberately.** `ratioOfReducedSums` weights by
   absolute spend, so the most expensive case decides the study. If that is
   intended, say so on the report; if not, `macroMean` treats cases equally.
6. **Add a case that isolates traversal.** All three current cases are served
   adequately by symbol lookup and text search. None requires callers,
   impact analysis, or cross-file traversal — the capability CBM claims and the
   one no case currently forces.
7. **Stamp benchmark runs.** These batches were launched with `--case`, so they
   carry no benchmark stamp and neither `harness-evals reprocess` nor `publish`
   can ingest them. Every rollup above had to be recomputed by hand.

## Limits

- n = 3 per arm per case; 36 runs total.
- Arms are time-blocked, not interleaved.
- Medians and means disagree in direction on several comparisons; both are
  reported throughout and neither should be quoted alone.
- The aggregate is magnitude-weighted and dominated by one case.
- `tool_execution_*` records carry no per-tool timestamps, so per-tool wall time
  cannot be measured; duration is step-level only.
- The `single-proxy` arm did not exercise a working proxy surface; its figures
  measure schema overhead on an unusable tool.
