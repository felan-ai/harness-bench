# Codebase Memory — initial run findings

**Runs and analysis dated 2026-09-01 / 2026-09-02.**

Point-in-time record of the first exploratory `felan-cbm-off` vs `felan-cbm-on`
runs and the offline transcript analysis that followed. **This document is a
snapshot and is not maintained** — it captures what the early runs showed and
what they triggered. Living case-family documentation is in
[`README.md`](./README.md); once the comparison moves to formal
`benchmarks:` reporting, that report supersedes the tables here.

Rendered version: `cbm-initial-findings.html` (this directory) and the
Artifact at `claude.ai/code/artifact/c7422264-c24d-4c98-9a86-44e7216e4dcc`.

## What this triggered

- **Felan bug report** — `ext-codebase-memory/src/services.ts`: `read_symbol`
  returns source 0 times (two envelope-parsing defects). See
  [Extension bugs](#extension-bugs-found-all-in-felan-none-in-codebase-memory-mcp-0108).
- **Case change** — `extension-config-scope` prompt tightened (imperative
  framing, "implement all three parts", strengthened classification rule 2)
  after two agents mis-read the original.
- **Harness recommendations** — cap `exec_command` output per line, enforce the
  advertised token ceiling, head-truncate greppable output, fix `yield_time_ms`
  for builds. See [Standing conclusion](#standing-conclusion-after-both-phases).

---

## Baseline — 2026-09-01

`cbm-project-instructions`, 3 trials/arm, `gpt-5.6-sol` / `thinking: medium`,
felan 0.20.1, binary 0.10.8. All 6 runs passed the verifier. CBM indexed
successfully in every `felan-cbm-on` run (~3,400 nodes / ~12,000 edges for the
`home-dev-felan` project) and called `search_graph`, `search_and_read_symbols`,
`read_symbol`, `search_code`. Only `search_and_read_symbols` returned usable
content — see **Root-cause analysis** below.

| Metric | CBM off | CBM on | CBM-on delta |
| --- | ---: | ---: | ---: |
| Correctness | 3/3 | 3/3 | tie |
| Median cost | $0.762 | $1.464 | +92% |
| Mean cost | $0.704 | $1.341 | +90% |
| Median duration | 308 s | 352 s | +14% |
| Mean duration | 332 s | 336 s | ~tied |
| Median tokens | 448 k | 1,249 k | +178% |
| Mean tokens | 493 k | 1,156 k | +134% |
| Mean tool-call rounds | 14.7 | 16.7 | +14% |

Per-run cost: off `$0.45 / $0.76 / $0.90`; on `$1.46 / $1.71 / $0.85`.

**Reading — superseded.** The headline above was originally read as "CBM costs
~2× on a localized task." Transcript analysis on 2026-09-02 does not support
attributing that gap to CBM. Most of it is an unrelated `grep`/source-map
accident that landed on three of four CBM-on runs and one of three CBM-off runs.
CBM's own measurable overhead on this task is **~+11–20%**, not ~2×. See the
next section; treat the table above as raw measurements, not as a CBM effect
size.

**Caveats.** n = 3/arm — run-to-run variance is wide (on: $0.85–$1.71, off:
$0.45–$0.90). One task, one model, `thinking: medium`, single-repo. At this n a
single unfiltered `grep` swings a run by ~$0.5, which is larger than CBM's
entire intrinsic effect.

## Root-cause analysis of the Phase-1 cost gap — 2026-09-02

Offline, from the seven saved `steps/run/stdout.log` streams (6 medium runs plus
the `thinking: max` smoke run, kept out of the table above). Method: per-request
`message.usage` for billing, `tool_execution_start.args` joined to
`tool_execution_end.result.content` for payloads. **`result.content` is an
array** — sum every item's text, or CBM's grep augmentation is missed.

Cost is 68–89% prompt-side (`gpt-5.6-sol`: $5/M uncached in, $0.50/M cache read,
$30/M out). Output tokens are near-identical across arms (off 4.9k/7.2k/5.3k, on
5.3k/6.7k/7.1k) and request counts are close (off 11/16/17, on 14/17/19). The
entire gap is context carried per request.

### Attribution

Each tool result is weighted by how many later requests re-send it
(`tokens × requests_remaining`), which is what actually gets billed. Category
sums land within ~3% of measured prompt totals for off-runs and ~25% low for the
large on-runs (the remainder is assistant/reasoning text), so read the shares as
approximate and the ordering as solid.

| run | cost | preamble | `node_modules/dist` carry | repo source carry | CBM tool carry |
| --- | ---: | ---: | ---: | ---: | ---: |
| off-0 | $0.452 | 19,371 | 25,638 | 199,487 | 0 |
| off-1 | $0.762 | 28,176 | 58,741 | 311,591 | 0 |
| off-2 | $0.899 | 29,937 | **427,376** | 234,744 | 0 |
| on-5 | $0.847 | 43,130 | 124,508 | 291,395 | 136,309 |
| on-3 | $1.464 | 31,780 | **660,982** | 126,655 | 83,746 |
| on-4 | $1.713 | 38,590 | **820,177** | 209,444 | 146,914 |

Cost is **strictly monotonic in `dist` carry across both arms** — it tracks the
blob, not the extension.

### The blob: `grep -R` over `dist/` matching source maps

Every run — all three CBM-off included — reads Pi's bundled
`node_modules/@earendil-works/pi-coding-agent/dist`, first touch at request 3–5
in both arms. The task requires it: the regression is about Pi's
`ResourceLoader`, which ships as bundled JS. What differs is only how the grep
was phrased.

`dist/` contains `.js.map` files. A source map is **one line** holding the whole
original source; `grep -R` prints whole matching lines and `head -N` bounds
lines, not bytes. Decomposing on-3's 120,310 B result — 6 matched lines total:

| file | lines | bytes |
| --- | ---: | ---: |
| `dist/main.js.map` | 1 | 65,063 |
| `dist/cli/args.js.map` | 1 | 30,403 |
| `dist/cli/args.d.ts.map` | 1 | 21,943 |
| `dist/main.js` + `cli/args.js` + `cli/args.d.ts` | 3 | 319 |

**117,409 of 117,728 bytes (99.7%) are source maps; 319 bytes were useful.**
off-2's and on-0's 120 KB results are each a *single* ~119,600-character line —
the truncator cutting through one map. The same run asking the same question two
ways settles it:

```
on-0 req5  grep -R -n -F 'Current working directory:' <pkg>                    → 120,577 B
on-0 req6  grep -R -n --include='*.js' --exclude='*.map' -F 'Current working…' →   1,066 B  (113×)

on-4 req6  grep -R -n "getAgentsFiles\|agentsFiles" dist | head -100           → 120,460 B
on-4 req7  grep -R -n --include='*.js' --exclude='*.map' 'getAgentsFiles\|…'   →   2,398 B  (50×)
```

Who filtered on the first attempt: off-0 (`--include='*.js' --include='*.d.ts'`,
5,018 B), off-1 (`find` → `sed` on specific files, ≤8.4 KB), on-5
(`--include=`, 4.1/3.6 KB). Who did not: off-2, on-0, on-3, on-4 (120–160 KB
each). **1-in-3 off vs 3-in-4 on is a coin flip at this n** — no CBM mechanism
was found behind it.

This is not a truncation bug. `ext-codex`'s `truncateOutput`
(`exec-session-manager.ts:434`) fired correctly, cutting 301,314 original tokens
to ~30,000. The lever is that `DEFAULT_MAX_OUTPUT_TOKENS` is 10,000 but the
model may pass `max_output_tokens`, ceilinged only by
`MAX_RETAINED_OUTPUT_CHARS = 4 MiB` (~1M tokens); these runs requested
20k–60k on exactly the `dist` greps.

### CBM's actual intrinsic overhead

Three components, smallest first:

1. **Fixed preamble: +509 tokens/request.** First-request prompt is exactly
   1,761 in every off-run and 2,270 in every on-run — 4 tool schemas plus the
   capability paragraph. Over 14–19 requests: <1% of the bill.
2. **Grep augmentation: negligible here.** 4–10 augmented results per on-run,
   361–918 tokens total, nearly all `results: 0`. A latent risk on a task where
   the graph *does* match; not a Phase-1 driver. (This supersedes an earlier
   draft that blamed it.)
3. **CBM payloads: 7–20% of prompt tokens.** 6–10 calls per run, 7.2–10.5k raw
   tokens, but they land early and ride everything after → 84k–147k carried.
   Almost all of it is `search_and_read_symbols` (5–19 KB/call).

Cleanest controlled pair (both blob-free): on-5 $0.847 vs off-1 $0.762 =
**+11%**.

### Extension bugs found (all in felan, none in `codebase-memory-mcp` 0.10.8)

Verified against the real 0.10.8 binary on a throwaway 2-file repo.

- **`read_symbol` returned source 0 times in 14 calls** across all four on-runs
  (Phase 1). Two independent defects in `ext-codebase-memory/src/services.ts`:
  - *`qualified_name` path* (8 calls, `candidates: []`): the extension sends
    `qn_pattern`, and the binary answers pattern queries with a **grouped**
    envelope (`{cols:[name,label,lines,in,out], groups:[{qn_prefix, file, rows}]}`)
    versus the **flat** one it returns for `query`
    (`{cols:[qn,label,file,lines,rank], rows}`). `searchCandidates()` (:160-168)
    handles only `results` or flat `cols`+`rows`, so a real match (`total:1`)
    parses as zero.
  - *`name` + `file_path` path* (6 calls, `candidates: 1` and still an error):
    the filter at :113 reads `candidate.file_path`, but the column is `file`
    (`cli search_graph --help`: core columns are `qn/label/file/lines/in/out`).
    `String(undefined ?? '').includes(...)` is always false.
  - Masked by unit tests that stub `search_graph` as
    `{results:[{qualified_name, file_path}]}` (`test/extension.test.ts:204-205`,
    `:239`) — a shape the binary never emits. `real-binary.e2e.test.ts` asserts
    only that the tools are registered (`:45-46`).
- **`search_and_read_symbols` returns a redundant candidate list**
  (`services.ts:147`): the full `search_graph` result (`limit`, default 20)
  next to snippets for only `read_limit` (default 6, max 12). Across the 9 calls
  in these runs the candidate blocks total 26,260 B, of which **13,329 B (51%)
  duplicates `symbols[].symbol` verbatim**. Small in absolute terms.

Consequence: with `read_symbol` broken, `search_and_read_symbols` (~15 KB) is
the only working read path where a targeted symbol read would be ~1.4 KB.
Fixing it should make CBM both useful and cheaper.

### What this means for the benchmark

`project-instructions` cannot separate CBM from grep-phrasing noise at n = 3.
Before drawing an effect size from it, either exclude source maps and vendored
directories at the `exec_command` level (making runs comparable), or raise n
substantially.

## Phase-2 results — 2026-09-02

`cbm-extension-config-scope` — see [`README.md`](./README.md) for the case
design. Eleven runs on disk; nine have usable streams (two off-runs died in
under five requests). Spend: $16.58 on 2026-09-02 plus ~$6.08 from the
2026-09-01 evening runs.

**The six original-prompt runs and the two replacements are not poolable.** Two
trials failed — off `05-56` (non-attempt: "the request only specifies the
required verification steps... not the feature or bug to address", 0 edits) and
on `06-23` (built clean but scoped the `configField.json` fields `user`, missing
fan-out rule 2). The prompt was then tightened (imperative framing, "implement
all three parts", strengthened rule 2) and *only the failed trials* were re-run.
So the third data point in each arm comes from a different condition, and by
construction it is that arm's cheapest run.

| arm | run (UTC) | prompt | status | cost | requests |
| --- | --- | --- | --- | ---: | ---: |
| off | 22-11 | orig | pass | $3.88 | 72 |
| off | 05-33 | orig | pass | $3.18 | 62 |
| off | 05-44 | orig | pass | $2.24 | 42 |
| off | 05-56 | orig | **fail** | $0.22 | 5 |
| off | 06-43 | new | pass | $1.53 | 38 |
| on | 22-00 | orig | pass | $2.08 | 34 |
| on | 05-58 | orig | pass | $2.56 | 37 |
| on | 06-11 | orig | pass | $2.03 | 38 |
| on | 06-23 | orig | **fail** | $3.38 | 60 |
| on | 06-53 | new | pass | $1.44 | 33 |

At face value CBM-on looks ~10–15% cheaper. It does not survive decomposition.

### The confound this time: build polling

Phase 1's source-map trap does **not** recur — this task never needs Pi
internals, and `node_modules` carry is ~0. A different arm-independent variable
dominates.

`exec_command` takes `yield_time_ms`. If a build outlives it, the agent polls
with `write_stdin`, and **every poll is a full request that re-sends the whole
conversation.** Every poll in these runs waited on the same monorepo commands,
in both arms:

```
pnpm --filter './packages/ext-*' build | type-check | test
pnpm --filter @felan-ai/agent-core build && pnpm --filter './packages/ext-*' build
pnpm --filter @felan-ai/felan build && pnpm --filter @felan-ai/felan test
```

(one exception: a `grep | cut | sort` pipeline in the failed on-run). Both arms
ran a similar number of builds — off 9–16, on 12–17 — and waited a similar total
wall time. Only the slicing differed:

| arm | run | `write_stdin` calls | poll-turns | wall waited | $ polling |
| --- | --- | ---: | ---: | ---: | ---: |
| off | 22-11 | 31 | 27 | 92 s | $1.45 |
| off | 05-33 | 26 | 26 | 100 s | $1.30 |
| off | 05-44 | 19 | 12 | 68 s | $0.56 |
| off | 06-43 | 18 | 16 | 60 s | $0.48 |
| on | 05-58 | 14 | 14 | 46 s | $0.77 |
| on | 06-11 | 11 | 10 | 35 s | $0.45 |
| on | 06-23 | 19 | 19 | 76 s | $0.93 |
| on | 22-00 | 3 | 3 | 51 s | $0.27 |
| on | 06-53 | 4 | 3 | 1 s | $0.09 |

Two counts because they differ: a **poll-turn** is a request whose every tool
call was `write_stdin`, which is what maps to cost; a few turns mixed a
`write_stdin` with another call and are counted as work. Use poll-turns when
recomputing.

Among the **passing** runs, poll-turns are 12–27 (off) vs 3–14 (on); the failed
`on-06-23` polled 19, higher than any passing on-run, so quoting a passes-only
range understates the on-arm spread. All four off-runs polled at
`yield_time_ms: 1000`; two of five on-runs used 30000 and needed almost no polls.
Polling is 12–37% of a run's bill.

### Cost with polling removed

Classing a request as a poll-turn when every tool call in it was `write_stdin`:

| arm | run | prompt | total | $ poll | **$ work** |
| --- | --- | --- | ---: | ---: | ---: |
| off | 22-11 | orig | $3.88 | $1.45 | $2.42 |
| off | 05-33 | orig | $3.18 | $1.30 | $1.88 |
| off | 05-44 | orig | $2.24 | $0.56 | $1.68 |
| off | 06-43 | new | $1.53 | $0.48 | $1.06 |
| on | 22-00 | orig | $2.08 | $0.27 | $1.81 |
| on | 05-58 | orig | $2.56 | $0.77 | $1.79 |
| on | 06-11 | orig | $2.03 | $0.45 | $1.58 |
| on | 06-23 | orig | $3.38 | $0.93 | $2.45 (failed) |
| on | 06-53 | new | $1.44 | $0.09 | $1.35 |

- Original prompt, passes: off median **$1.88** vs on **$1.79** — 5%, inside the
  spread.
- Tightened prompt, n=1 each: off **$1.06** vs on **$1.35** — CBM-on **27% more
  expensive**.

**Phase 2 shows no CBM advantage on a wide-traversal task once polling is
removed.**

### No exploration saving either

Raw tokens read (uncarried) — what the agent actually took in:

| arm | run | prompt | source | CBM tools | augmentation | total |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| off | 22-11 | orig | 65,392 | — | — | 65,392 |
| off | 05-33 | orig | 62,300 | — | — | 62,300 |
| off | 05-44 | orig | 74,072 | — | — | 74,072 |
| on | 22-00 | orig | 35,315 | 9,680 | 2,054 | **47,049** |
| on | 05-58 | orig | 52,364 | 12,607 | 1,316 | 66,287 |
| on | 06-11 | orig | 53,250 | 5,688 | 4,245 | 63,183 |
| off | 06-43 | new | 39,640 | — | — | 39,640 |
| on | 06-53 | new | 35,140 | 8,810 | 1,477 | **45,427** |

CBM-on reads ~20% less raw source and pays it back in payloads: one run 28%
below the off baseline, two a wash, and the tightened-prompt run **15% above**
it. Both arms still `cat` every `ext-*/src/config.ts` in a shell loop (37–88 KB
per call) — CBM never replaced that.

### CBM's footprint on this task

- **Preamble +509 tokens/request** — the same *delta* as Phase 1, not the same
  absolute baseline (the task prompt differs). Phase-2 first request: off 2,331
  vs on 2,840; under the tightened prompt 2,539 vs 3,048. Phase 1 was 1,761 vs
  2,270. All three pairs differ by exactly 509.
- **Total CBM footprint 13–23% of prompt tokens** (Phase 1: 7–20%).
- **Grep augmentation is now material.** Phase 1's latent risk realized: the
  graph matches here, so every augmented grep returns 20 results at ~2.9–3.6 KB
  — 1.3–5.7k raw tokens, **23k–225k carried**, up to a third of CBM's footprint.
  It also repeats the identical ~2,947 B block across three or four separate
  greps. `ext-codebase-memory/src/grep-augmentation.ts` has no size cap.
- **`read_symbol` returned source 0 times in 15 calls** here — **0 of 29 across
  both phases**, same two bugs.

### The failed CBM-on run

`06-23` enumerated every `configField.` site and had the per-file field dump in
context, but never grepped or queried `configField.json` specifically — it
applied the classification rule without splitting by constructor. Its
`search_code` for `configField.` returned 0 results and the built-in `grep` tool
also returned 0, so it fell back to `exec_command`. No evidence CBM caused the
error; the run had the data it needed.

## Standing conclusion after both phases

Twice now the headline cost signal was dominated by incidental agent behaviour
worth $0.5–1.5 per run — Phase 1 an unfiltered `grep` matching `.js.map` files,
Phase 2 one-second build polling — both larger than CBM's intrinsic effect in
either direction. Best current estimate of that effect: **+11–20% on a localized
task, no measurable benefit on a wide fan-out**. Correctness is a wash (every
clean run in both phases passed).

Before this benchmark can resolve a 10–20% effect at n=3, the confounds have to
stop being free variables:

1. **Cap `exec_command` output per LINE.** A source-map line is 119,000
   characters; no useful grep hit is. Clamp lines to ~1–2k chars *before* the
   total-size trim in `truncateOutput`
   (`ext-codex/src/exec-session-manager.ts:434`). This also covers minified JS,
   base64, one-line JSON and CSV.
2. **Enforce the policy ceiling the schema already advertises.**
   `maxCharsForTokens` (`:455`) clamps only to `MAX_RETAINED_OUTPUT_CHARS`
   = 4 MiB (~1M tokens) while the default is 10k; these runs requested 20k–60k
   on exactly the bad greps.
3. **Truncate from the head, not only the tail** (`tail()`, `:462`) — grep hits
   are at the top, build failures at the end.
4. **Fix `yield_time_ms` for build commands, or exclude poll-turns from the cost
   metric.**

Scope note: `exec_command` is GPT-only. `ext-codex` swaps it in only when
`supportsCodexModel()` passes — provider `openai`/`openai-codex` **and** model id
matching `^gpt` (`ext-codex/src/model-policy.ts:5-8`). Other models keep Pi's
`read`/`bash`/`edit`/`write`, whose truncation behaviour is unverified here (Pi
source is not installed in the felan checkout). The same one-huge-line problem
may exist on that path.
