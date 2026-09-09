# Codebase Memory modes — September 8, 2026

## Outcome

**The corrected v2-task runs favor curated/direct, not a blanket CBM-off recommendation.** Architecture: curated and direct achieve full verifier reward in 3/3 trials; off achieves it in 1/3 and proxy in 0/3. Curated costs almost the same as off; direct has the fastest median agent duration. Config-scope: direct has the best median cost/time, curated the best mean cost, and both substantially outperform off with all trials passing.

Overall, **curated is the conservative cost choice; direct is the latency-oriented alternative**. Neither dominates both objectives. Proxy is not the preferred mode: lower architecture cost accompanies lower fact coverage, and its coding savings trail curated/direct. These are observed n=3 outcomes, not statistically established rankings.

**Main caveat:** much of the coding request/cost difference is associated with build polling, not fewer substantive navigation turns. Proxy still encounters schema failures despite improved field discovery. Architecture's apparent quality advantage also includes wording-sensitive verifier effects. These observations limit causal claims about CBM itself.

## Corpus: corrected cases, not the superseded September 5 runs

Only these two completed, separately invoked batches are included (UTC on September 8):

| Case | Batch | Start → completion | Trials |
|---|---|---|---|
| `cbm-extension-architecture` | `20260908-090907-5a66` | 09:09:07.259 → 10:06:15.076 | 4 modes × 3 |
| `cbm-extension-config-scope` | `20260908-114759-951e` | 11:47:59.653 → 14:19:18.470 | 4 modes × 3 |

Both manifests use `--concurrency 1 --attempts 3`; order is off ×3, curated ×3, direct ×3, proxy ×3. No smoke, preflight, project-instructions or September 5 runs enter these statistics. All 24 attempts are retained. Artifact root is `.harness-evals/`; manifests are `batches/<batch>.json`, and the full run-directory inventory appears below.

### Task and runtime parity

- **Prompts now match v2 exactly.** SHA-256 of the archived first user-message text, identical across every new arm and the corresponding September 4 v2 prompt: architecture `82d11f33467894dcbb956c15461c05c01cf937a2b6be14d3ab232ec516abf852`; config-scope `29694c9ba0680fa2d7ae9c43b35e5cec6cc80e26c30e6f83d438fdf6fceb2047`. The September 5 prompts do not match.

- Current verifier assets (two architecture files, four config-scope files) byte-match v2 source commit `f9eca43`; restoration commit is `d5dc748`. Archived architecture grading again reports coverage out of **5**, not the superseded 12-fact × citation metric. Run artifacts record the verifier command/mount, not immutable historical asset snapshots; source equality plus archived behavior is the available evidence.

- Starting Git commits are unchanged: architecture `e5867637569bd1c7ad08420b79ec4031a5733f57`; config-scope `51a18d8f0c853a06867ddbd48046ad4a84307058`.

- All 24 summaries/image probes identify **Felan 0.23.2**, provider `openai-codex`, model `gpt-5.6-sol`, medium thinking, and one shared resolved image. Archived settings are identical after removing the intended CBM enable/mode fields; `codex.fast: true`, `sessionTitle: false`, RTK optimizer off. Matching sibling source is `@felan-ai/ext-codebase-memory` **0.3.1**; the runtime recipe pins `codebase-memory-mcp` **0.10.8**. These package/recipe facts are distinguished from the directly probed Felan version.

Thus comparison with [v2](cbm-v2-rootcause-2026-09-04.md) is relevant again for task/behavior, but **absolute cross-release cost/time is not an isolated extension effect**: Felan changed from 0.21.11 to 0.23.2.

## Metrics

Independent medians unless marked mean. USD is recorded usage cost. Step seconds measure agent execution; run seconds include harness overhead. Requests are billed assistant completions, not individual tool executions.

### `cbm-extension-architecture`

| Mode | Rewards, trial order | Harness pass / reward=1 | Cost median / mean | Step / run seconds | Requests |
|---|---|---|---:|---:|---:|
| off | 0.8 / 0.8 / 1 | 3/3 / 1/3 | $1.200 / $1.339 | 233.8 / 240.9 | 15 |
| curated | 1 / 1 / 1 | 3/3 / 3/3 | $1.213 / $1.269 | 244.1 / 247.7 | 17 |
| direct | 1 / 1 / 1 | 3/3 / 3/3 | $1.256 / $1.292 | 222.7 / 227.0 | 17 |
| proxy | 0.8 / 0.8 / 0.6 | 3/3 / 0/3 | $1.036 / $1.230 | 248.3 / 251.9 | 14 |

| Mode | Prompt tokens | Uncached | Cache-read | Output | Total |
|---|---:|---:|---:|---:|---:|
| off | 946,059 | 109,963 | 836,096 | 8,562 | 953,802 |
| curated | 883,334 | 108,038 | 775,296 | 9,640 | 892,824 |
| direct | 1,008,861 | 114,141 | 894,720 | 8,481 | 1,016,806 |
| proxy | 790,573 | 99,019 | 699,520 | 8,707 | 798,258 |

### `cbm-extension-config-scope`

| Mode | Rewards, trial order | Harness pass / reward=1 | Cost median / mean | Step / run seconds | Requests |
|---|---|---|---:|---:|---:|
| off | 1 / 1 / 1 | 3/3 / 3/3 | $3.895 / $3.847 | 727.7 / 809.3 | 80 |
| curated | 1 / 1 / 1 | 3/3 / 3/3 | $2.243 / $2.408 | 666.2 / 772.3 | 41 |
| direct | 1 / 1 / 1 | 3/3 / 3/3 | $2.216 / $2.586 | 612.9 / 691.0 | 43 |
| proxy | 1 / 1 / 1 | 3/3 / 3/3 | $2.875 / $3.195 | 710.4 / 786.9 | 66 |

| Mode | Prompt tokens | Uncached | Cache-read | Output | Total |
|---|---:|---:|---:|---:|---:|
| off | 5,717,681 | 122,417 | 5,595,264 | 14,226 | 5,733,850 |
| curated | 2,778,403 | 104,483 | 2,673,920 | 14,359 | 2,791,196 |
| direct | 2,684,119 | 102,743 | 2,581,376 | 12,771 | 2,697,837 |
| proxy | 3,973,768 | 94,472 | 3,879,296 | 15,445 | 3,989,213 |

Cache-write tokens are zero. Prompt = uncached + cache-read, and total = prompt + output **per trial**; independent column medians need not add. Prompt usage counts repeated context, not unique code retrieved.

| Case / mode vs off | Median cost | Mean cost | Median step time | Median prompt tokens |
|---|---:|---:|---:|---:|
| architecture / curated | +1.0% | -5.2% | +4.4% | -6.6% |
| architecture / direct | +4.7% | -3.5% | -4.8% | +6.6% |
| architecture / proxy | -13.7% | -8.1% | +6.2% | -16.4% |
| config-scope / curated | -42.4% | -37.4% | -8.5% | -51.4% |
| config-scope / direct | -43.1% | -32.8% | -15.8% | -53.1% |
| config-scope / proxy | -26.2% | -16.9% | -2.4% | -30.5% |

Architecture reward is a **loose five-fact directional check**, not proof of comprehensive correctness or citation precision. A harness pass can coexist with partial reward or a failed non-gating tool-error assertion. Do not credit proxy's cheaper architecture run as equivalent-quality savings. Coding reward is binary; all 12 coding trials pass.

The direct–curated coding median-cost gap is only **$0.027 (1.2%)**; mean cost reverses their order. Outliers matter: direct coding costs **$3.798/$2.216/$1.745**, curated **$3.159/$2.243/$1.824**, proxy **$4.606/$2.875/$2.105**. All remain in the tables. Total spend: architecture **$15.390**, config-scope **$36.112**, combined **$51.502**. Six-trial spend by mode: off **$15.558**, curated **$11.034**, direct **$11.635**, proxy **$13.275**; pooling weights the expensive coding task more heavily.

## Transcript mechanisms

For examples, `A0`–`A11` and `C0`–`C11` denote manifest/run-inventory order within architecture and config-scope; line references are to each run's `steps/run/stdout.log` unless stated otherwise.

### Visible/used tools and result sizes

Off has no CBM tools. Curated exposes four: `codebase_memory`, `read_symbol`, `search_and_read_symbols`, `search_code`. Proxy exposes only `codebase_memory(command, arguments)` with a description enumerating command field names. Direct exposes 12 typed commands: `index_repository`, `search_graph`, `query_graph`, `trace_path`, `get_graph_schema`, `get_architecture`, `index_status`, `check_index_coverage`, `detect_changes`, `get_code_snippet`, `search_code`, `list_projects`. This is an authored command catalog, not unrestricted dynamic MCP discovery. Mode settings, calls and matching registration source establish the surfaces; stdout does not export the complete provider request schema.

Cells are **calls / UTF-8 result-text bytes**, summed over three trials and including errors. Unlisted commands were unused; off is zero throughout.

| Tool | Architecture curated | Architecture direct | Architecture proxy | Config curated | Config direct | Config proxy |
|---|---:|---:|---:|---:|---:|---:|
| `codebase_memory` | 4 / 12,948 | — | 9 / 8,352 | 1 / 3,608 | — | 8 / 2,872 |
| `read_symbol` | 28 / 51,966 | — | — | 6 / 9,701 | — | — |
| `search_and_read_symbols` | 24 / 292,363 | — | — | 4 / 26,083 | — | — |
| `search_code` | 16 / 64,992 | 44 / 307,366 | — | 4 / 1,126 | 21 / 103,621 | — |
| `get_code_snippet` | — | 78 / 509,044 | — | — | 12 / 53,642 | — |
| `get_architecture` | — | 5 / 22,473 | — | — | 2 / 3,698 | — |
| `search_graph` | — | 4 / 30,155 | — | — | 3 / 1,152 | — |
| `index_repository` | — | 2 / 3,988 | — | — | — | — |
| `index_status` | — | 1 / 2,907 | — | — | 1 / 3,907 | — |
| `check_index_coverage` | — | 1 / 1,209 | — | — | — | — |
| **Total** | **72 / 422,269** | **135 / 877,142** | **9 / 8,352** | **15 / 40,518** | **39 / 166,020** | **8 / 2,872** |

Proxy subcommands: architecture `get_architecture` **7**, `list_projects` **2**; coding `search_graph` **6**, `list_projects` **2**. Curated gateway calls are architecture `get_architecture` **4**, coding `search_graph` **1**.

Architecture shows genuine shell-to-CBM substitution: off/curated/direct/proxy `exec_command` calls are **73/56/21/76**, with **1,442,698/662,429/188,197/1,254,410 bytes**. Direct replaces shell reads with 78 snippets and 44 text searches, not graph traversal (`query_graph` and `trace_path` are unused). It delivers about twice curated's CBM payload but achieves similar session cost and full measured coverage. No architecture polling occurs.

V2's duplicated `symbols[].symbol` field is absent in all **149 snippets across 28 new `search_and_read_symbols` results**; no full top-level `candidates` array appears. That payload issue is resolved in this corpus. Source retrieval still dominates curated bytes; compaction alone cannot explain the entire runtime change.

Initial prompt tokens, identical within each arm, are architecture **2,700/3,208/5,176/3,068** and coding **3,116/3,624/5,592/3,484** (off/curated/direct/proxy). Added initial context is **508 curated**, **2,476 direct**, **368 proxy** tokens. These combine instructions and schemas, not schemas alone; count input plus cache-read, not uncached input alone.

### Proxy recovery remains unreliable

There are **9 flagged failures in 17 proxy calls: eight schema rejections and one wrong-active-project rejection**. Direct has **zero flagged or embedded CBM errors in 174 calls**. No missing-project error occurs; omitting the project successfully selects the active repository.

- Architecture: invalid `aspects` arrays contain `modules`/`data_flow`; A10 retries with a comma-separated string. A9/A11 eventually recover, but A10 obtains no successful architecture query. A11 separately supplies `project:"felan"` and receives `Codebase Memory queries must use the active project; omit project to select it automatically` before succeeding with `{}`. See A9:206–309, A10:182–263, A11:216–310.
- Coding: all initial proxy searches use `detail:"full"`; C11 later uses `format:"summary"`. These violate the authored enums (`detail`: `ids`/`default`; `format`: `tree`/`json`). C9/C10 recover; C11 still fails after discovering the correct project. See C9:195–250, C10:189–273, C11:158–239. Project discovery returns `home-dev-felan`, not `felan`.
- **Root limitation:** matching ext 0.3.1 source adds field names via `describeRawCommands()`, but not types/enumerations. The remaining failures demonstrate that field-name discovery is insufficient. Generic validation errors end with `Unknown fields are not allowed` even for invalid values/types in accepted fields. Do not diagnose every rejection as an unknown-field or indexing problem. Source: sibling Felan commit `179a2cf8fa56c7831809617269888dec9249e7f1`, `packages/ext-codebase-memory/src/{tools,raw-catalog,raw-dispatch}.ts`.

Curated has **seven embedded `No matching symbol found` results despite `isError:false`**, plus seven empty searches; direct has five empty architecture searches. Zero flagged errors is not equivalent to every call being useful. All **40 native `grep` executions fail with `spawn rg ENOENT`** (architecture off/curated/direct/proxy 4/5/3/5; coding 6/9/3/5). Shell quoting also causes some architecture command failures. Shared infrastructure defects need not affect every arm equally.

### Coding: polling explains much of the request gap

Across three coding trials:

| Mode | Exec calls / bytes | Poll calls / bytes | Poll-only assistant turns | All assistant requests | Patch calls / flagged failures |
|---|---:|---:|---:|---:|---:|
| off | 138 / 812,496 | 133 / 234,826 | 131 | 248 | 19 / 0 |
| curated | 125 / 691,402 | 44 / 107,644 | 42 | 152 | 17 / 1 |
| direct | 112 / 569,606 | 50 / 159,293 | 47 | 154 | 16 / 0 |
| proxy | 131 / 623,594 | 107 / 218,687 | 104 | 220 | 22 / 0 |

Off versus curated differs by **96 requests**, of which **89** are the difference in poll-only turns; versus direct it differs by **94 requests**, **84** in poll-only turns. Ordinary exec/poll output also falls, but this is not solely structural navigation becoming cheaper.

The median-cost trials illustrate the mechanism: **C0 off $3.895/79 requests/29 poll-only turns**, **C4 curated $2.243/41/1**, **C7 direct $2.216/43/4**. Costs of requests issuing only polls are respectively **$1.283/$0.042/$0.185**. A separate request-count illustration, C2 off versus C4/C7, is **80/41/43 total requests**, **44/1/4 poll-only**, and **36/40/39 remaining requests**. C2 polls with 1,000 ms waits, C4/C7 with 30,000 ms waits. Multiple polls can share one model request.

This is descriptive attribution, **not a counterfactual cost correction**: removing polling would change scheduling, context and caching. It does mean the measured 42–43% coding cost win cannot be attributed entirely to CBM retrieval. Standardizing the polling policy would be necessary to isolate that effect in any separately authorized future comparison.

### Reports, patches and quality limits

Architecture reports are substantial (roughly 2,182–3,040 words). Off misses `tool-to-model-path` once and `loading-and-binding` once; all proxy reports miss the tool path, with one also missing `config-reaches-extension`. Curated/direct pass all five facts. Spot checks show **some false negatives/wording sensitivity**: A1 describes ordered loading and binding without the exact loader names; A11 describes config injection without the expected wording. Tool-path misses are better described as insufficiently explicit `registerTool`→host/model explanations than proof of a wholly wrong architectural model. Full reward is useful but weak evidence of semantic superiority; the restored verifier no longer grades citation precision.

Coding patches pass every hidden behavioral verifier. Curated C3 has one recovered `Duplicate patch path` failure. Final agent summaries report focused passing checks but also broader `pnpm verify` failures (license/environment/process issues); the claim that those are pre-existing is **not independently established**. Do not confuse hidden-verifier success with a clean full repository suite. No new baseline/known-good verifier control was executed for this analysis.

## Comparison with prior findings

| Case | v1 on-vs-off median cost / time | v2 on-vs-off | New curated-vs-off |
|---|---|---|---|
| architecture | +16.1% / +27.3% | +18.0% / −1.2% | **+1.0% / +4.4%** |
| config-scope | +8.2% / +9.4% | −15.0% / −8.4% | **−42.4% / −8.5%** |

The old architecture curated median-cost loss is now nearly neutral, with a mean-cost saving and full measured coverage in all three trials. It is no longer accurate to describe all enabled modes as clearly inferior. The **v2 config-scope cost/time win recurs on the restored v2 task**, now with much lower request counts (off 80, curated 41, direct 43). Direct also wins coding cost/time; proxy has a weaker gain.

V1 is only historical context because its tasks differed. V2 remains a useful directional comparison, not a controlled release A/B. Its report attributed coding savings to reduced ordinary source-output/context carry and architecture overhead to extensive retrieval; the new transcript evidence below tests those mechanisms rather than carrying over the deleted report's conclusions.

## What this now says about raw MCP and Claude Code

**The new direct result is not the previous failure pattern.** Architecture direct has full measured coverage, median time **−4.8%**, median cost **+4.7%** and mean cost **−3.5%** versus off. Coding direct wins measured cost/time, although polling explains much of the request gap. These runs neither reproduce a dramatic architecture token saving nor justify saying direct mode broadly loses.

The engine's advantage is that a precomputed graph can answer structural relationships without many source reads. Exposing it directly only enables that strategy; it does not compel the model to use it. Here direct mostly uses snippets and textual search, with no `trace_path`/`query_graph` calls. Architectural explanation still needs source-based synthesis, so its prompt total remains near off (**1,008,861 versus 946,059**), not orders of magnitude lower. Model steps, repeated context, fixed instructions and cache pricing determine session cost; millisecond engine queries are not full agent latency.

Published Claude evidence is not uniform: the [upstream paper](https://arxiv.org/html/2603.27277v1) reports roughly 10× fewer tokens and 2.1× fewer calls for an Opus 4.6 MCP agent, but quality is **83% versus 92%** for its Explorer control and indexing is amortized. An [independent Sonnet comparison](https://skillproof.dev/blog/codebase-memory-mcp-benchmark) reports equal 8/8 correctness but **172,319 versus 75,817 tokens**, favoring its baseline. Neither is this Felan/model/task combination or an independent reproduction by us.

Felan direct is analogous to raw typed MCP exposure, but still uses a bounded authored catalog, project injection, result serialization and Felan-specific instructions. Matching schemas does not match model policy, tasks, index state or baseline tools. Likewise, Docker alone does not establish CLI fallback: the ordinary Felan CLI's HostAgentRuntime supports persistent stdio; no run-level transport measurement here attributes latency to startup overhead. A specific personal Claude on/off result would require its transcripts to explain precisely. The practical evidence in this corpus favors investigating **proxy type/enum discoverability and polling policy**, not blaming the MCP engine or assuming a universal Claude token advantage.

## Run inventory

Every ID below is a full directory name under `.harness-evals/runs/`; the embedded timestamp is UTC. Technical arm names map directly to off/curated/direct, with `felan-cbm-single-proxy` meaning proxy.

| Run ID | Reward | USD | Agent seconds | Requests |
|---|---:|---:|---:|---:|
| `cbm-extension-architecture-felan-cbm-off-2026-09-08T09-09-07-267Z-0` | 0.8 | 1.129581 | 250.166 | 13 |
| `cbm-extension-architecture-felan-cbm-off-2026-09-08T09-14-21-067Z-1` | 0.8 | 1.686297 | 233.785 | 15 |
| `cbm-extension-architecture-felan-cbm-off-2026-09-08T09-18-22-240Z-2` | 1 | 1.200153 | 223.494 | 15 |
| `cbm-extension-architecture-felan-cbm-curated-2026-09-08T09-22-14-881Z-3` | 1 | 1.212538 | 227.586 | 16 |
| `cbm-extension-architecture-felan-cbm-curated-2026-09-08T09-26-08-463Z-4` | 1 | 1.191898 | 244.129 | 17 |
| `cbm-extension-architecture-felan-cbm-curated-2026-09-08T09-30-16-278Z-5` | 1 | 1.403950 | 361.150 | 21 |
| `cbm-extension-architecture-felan-cbm-direct-2026-09-08T09-36-21-625Z-6` | 1 | 1.092656 | 219.381 | 17 |
| `cbm-extension-architecture-felan-cbm-direct-2026-09-08T09-40-05-074Z-7` | 1 | 1.256415 | 222.663 | 18 |
| `cbm-extension-architecture-felan-cbm-direct-2026-09-08T09-43-52-175Z-8` | 1 | 1.527287 | 494.110 | 17 |
| `cbm-extension-architecture-felan-cbm-single-proxy-2026-09-08T09-52-12-741Z-9` | 0.8 | 1.035575 | 383.619 | 14 |
| `cbm-extension-architecture-felan-cbm-single-proxy-2026-09-08T09-58-40-211Z-10` | 0.8 | 1.618051 | 248.300 | 19 |
| `cbm-extension-architecture-felan-cbm-single-proxy-2026-09-08T10-02-52-226Z-11` | 0.6 | 1.035281 | 196.574 | 14 |
| `cbm-extension-config-scope-felan-cbm-off-2026-09-08T11-47-59-658Z-0` | 1 | 3.894787 | 679.355 | 79 |
| `cbm-extension-config-scope-felan-cbm-off-2026-09-08T12-00-52-571Z-1` | 1 | 3.450409 | 837.612 | 89 |
| `cbm-extension-config-scope-felan-cbm-off-2026-09-08T12-16-18-598Z-2` | 1 | 4.196322 | 727.694 | 80 |
| `cbm-extension-config-scope-felan-cbm-curated-2026-09-08T12-29-48-122Z-3` | 1 | 3.158590 | 704.392 | 73 |
| `cbm-extension-config-scope-felan-cbm-curated-2026-09-08T12-42-47-889Z-4` | 1 | 2.243165 | 543.877 | 41 |
| `cbm-extension-config-scope-felan-cbm-curated-2026-09-08T12-53-07-165Z-5` | 1 | 1.823520 | 666.171 | 38 |
| `cbm-extension-config-scope-felan-cbm-direct-2026-09-08T13-05-59-605Z-6` | 1 | 3.798077 | 621.584 | 73 |
| `cbm-extension-config-scope-felan-cbm-direct-2026-09-08T13-17-45-957Z-7` | 1 | 2.215943 | 612.887 | 43 |
| `cbm-extension-config-scope-felan-cbm-direct-2026-09-08T13-29-17-130Z-8` | 1 | 1.744964 | 561.331 | 38 |
| `cbm-extension-config-scope-felan-cbm-single-proxy-2026-09-08T13-39-52-580Z-9` | 1 | 4.606108 | 980.496 | 100 |
| `cbm-extension-config-scope-felan-cbm-single-proxy-2026-09-08T13-57-29-682Z-10` | 1 | 2.875358 | 710.440 | 66 |
| `cbm-extension-config-scope-felan-cbm-single-proxy-2026-09-08T14-10-36-764Z-11` | 1 | 2.104971 | 446.895 | 54 |

## Evidence and limits

Metrics: `summary.json`, `steps/run/cost.json`, step durations and `verifier/reward.json`. Controls: batch manifests, `run-started.json`, `workspace-source.json`, `image-resolution.json`, archived user messages and non-secret settings. Mechanisms: `steps/run/stdout.log` start/end events joined by exact `toolCallId`; UTF-8 result text counted once, not streaming updates or serialized envelopes. Reward interpretation also uses `verifier/stdout.log` and recorded assertions. Prior reports: [v1](cbm-rootcause-2026-09-04.md), [v2](cbm-v2-rootcause-2026-09-04.md).

Three sequential trials per arm, blocked arm order, model sampling, provider load, build/poll differences and caching prevent strong causal or statistical claims. No new paid/provider calls, benchmark runs, verifier executions or config/source changes were made for this analysis.

Validation: all 24 run IDs are unique; summary/step costs, verifier rewards and transcript request/input/cache/output totals agree. Report whitespace and `bun run list:smoke` pass. `bun run list` fails on `<<<<<<< HEAD` at `felan-extension-evals.yaml:650`; `git diff --check` flags merge conflicts there and in `evals/cases/codebase-memory/README.md`. These conflicts appeared during analysis and were left untouched. They affect current configuration discovery, not the retained run artifacts used above.
