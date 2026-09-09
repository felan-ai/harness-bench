# Codebase Memory root-cause report — 2026-09-04 rev2 n=3

Scope: offline analysis only. No new provider/benchmark runs were made. Data came from the 18 requested run directories under `.harness-evals/runs/` and `evals/cases/codebase-memory/results/cbm-rev2-n3-2026-09-04.{json,csv}`.

## Executive conclusion

CBM-on did not win because its working retrieval was not cheap enough to offset its fixed overhead and the extra navigation it encouraged.

Measured median outcome from the exported benchmark:

| case | off cost | on cost | cost delta | off step s | on step s | latency delta | off req | on req |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| extension-architecture | $0.584 | $0.678 | +16.1% | 191.2 | 243.4 | +27.3% | 11 | 13 |
| extension-config-scope | $1.711 | $1.852 | +8.2% | 676.1 | 740.0 | +9.4% | 38 | 37 |
| project-instructions | $0.649 | $0.575 | -11.5% | 182.6 | 301.7 | +65.2% | 16 | 17 |

The important decomposition:

- Fixed CBM prompt/schema preamble is real but small: first request is +508 tokens in clean off/on pairs; across all 9 CBM-on runs that is about 67k prompt tokens, <$0.01 at cached-input-heavy pricing.
- Direct CBM tool payloads are material: 92 explicit CBM tool calls returned 264,706 B and about 960k carried token-equivalents across later requests. This is the largest extension-owned cost lever.
- Grep augmentation text is small in tokens but noisy in tool count: 42 augmented `exec_command` results added only 21,389 B / ~62k carried token-equivalents, but most were empty and each attempted a CBM `search_code` within a 1.5 s budget.
- Extra latency is not primarily index build wall-clock. The first assistant request starts normally; first CBM calls return in ordinary tool batches. The project-instructions +65% latency is mostly longer assistant-turn gaps after CBM-on added structural/tool context, not polling or build waits.
- The two earlier `read_symbol` defects are present in older 0.1.2 workspace source but fixed in the 0.1.5 source present in the architecture workspace and used by the Felan 0.21.3 runtime. The rev2 failure mode shifted from "read_symbol returns no source" to "CBM returns useful source but often duplicates/over-fetches and induces extra navigation."

Implementation direction: do not start with another benchmark or a binary change. Patch the extension wrapper first, beginning with the compact `search_and_read_symbols` return shape and bounded/parallel snippet reads; then gate grep augmentation. Those changes attack the measured extension-owned payload and latency without changing benchmark prompts or verifier expectations.

## Corpus and version notes

Target runs:

- `20260903-195408-3bad`: architecture 6 runs and config-scope off 3 runs.
- `20260904-053429-894e`: project-instructions 6 runs.
- `20260904-060435-6e19`: config-scope on 3 runs.

Version caveat: the task workspaces are Felan repositories at each case's pinned commit, not necessarily the installed runtime package used by the evaluated agent. Architecture workspaces contain `packages/ext-codebase-memory/package.json` version `0.1.5`; config-scope workspaces contain version `0.1.2`; project-instructions workspaces do not have `packages/ext-codebase-memory/`. The run image installed `@felan-ai/felan@0.21.3`; `steps/run/stdout.log` behavior matches the 0.1.5 fixed parser, and architecture workspace source provides file:line evidence for 0.1.5.

## Method

For each run I parsed `steps/run/stdout.log` JSONL and `steps/run/cost.json`.

- Billing totals use `cost.json` / exported benchmark usage.
- Request count/order uses assistant `message_end.message.usage.input > 0`.
- Tool calls are joined by exact `toolCallId` from `tool_execution_start` to `tool_execution_end`.
- Tool result bytes sum every text block in `result.content[]`.
- Carry estimate uses `estimated result tokens × requests_remaining`, where request `k` tool results are resent on requests `k+1..N`. For `exec_command` I used the emitted `Original token count` when present; for CBM text I used `chars/4`. Treat carry numbers as attribution estimates, not exact tokenizer output.
- For grep augmentation, the catalogue row records the whole augmented `exec_command` result; the attribution table below separately isolates only the appended `Codebase Memory augmentation` block.

## Cost attribution

### Median usage by case

| case | arm | cost | prompt tokens | uncached input | cache-read input | output | requests |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| extension-architecture | off | $0.584 | 359,440 | 58,000 | 301,440 | 4,769 | 11 |
| extension-architecture | on | $0.678 | 433,610 | 68,554 | 365,056 | 5,098 | 13 |
| extension-config-scope | off | $1.711 | 1,894,893 | 80,749 | 1,814,144 | 13,351 | 38 |
| extension-config-scope | on | $1.852 | 2,069,828 | 100,036 | 1,969,792 | 9,950 | 37 |
| project-instructions | off | $0.649 | 443,966 | 56,126 | 387,840 | 6,513 | 16 |
| project-instructions | on | $0.575 | 412,456 | 41,000 | 371,456 | 6,374 | 17 |

### Extension-owned prompt carry, CBM-on only

| case | direct CBM calls | direct CBM bytes | direct CBM carry est. | grep augment calls | augment bytes only | augment carry est. | preamble est. |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| extension-architecture | 52 | 140,806 | 364,836 | 3 | 2,967 | 3,242 | ~28,448 |
| extension-config-scope | 11 | 54,902 | 381,370 | 24 | 10,635 | 44,527 | ~67,056 |
| project-instructions | 29 | 68,998 | 213,646 | 15 | 7,787 | 14,266 | ~27,432 |


Interpretation by case:

- **extension-architecture**: CBM-on's +94k median prompt tokens are mostly explained by direct CBM payload carry plus two extra requests. CBM replaced some raw `exec_command` reading, but not enough; the read-only report still needed ordinary file inspection for citations.
- **extension-config-scope**: direct CBM payloads and augmentation are visible, but the dominant spend remains normal repo inspection/build/test context. CBM-on used one fewer median request but had higher uncached input and similar carried context; it did not reduce the fan-out work.
- **project-instructions**: CBM-on cost is lower because the off arm had one high-context outlier and more poll/context carry. CBM-on still adds direct CBM payloads; its win on cost is not a CBM efficiency win because latency worsened sharply.

## Latency attribution

| case | arm | median step s | requests | explicit CBM calls | augmented exec results | build/poll calls |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| extension-architecture | off | 191.2 | 11 | 0 | 0 | 0 |
| extension-architecture | on | 243.4 | 13 | 52 total / 17.3 per run | 3 total | 0 |
| extension-config-scope | off | 676.1 | 38 | 0 | 0 | 41 total polls |
| extension-config-scope | on | 740.0 | 37 | 11 total / 3.7 per run | 24 total | 30 total polls |
| project-instructions | off | 182.6 | 16 | 0 | 0 | 6 total polls |
| project-instructions | on | 301.7 | 17 | 29 total / 9.7 per run | 15 total | 0 polls |

Project-instructions is the strange signal: -11.5% cost but +65.2% latency.

Evidence against indexing/polling as the main cause:

- Step-start to first message is normal (`~2.3 s` in inspected CBM-on vs `~3.1 s` in inspected off), so background indexing did not block session start.
- The first explicit `codebase_memory` call in `cbm-project-instructions-felan-cbm-on-2026-09-04T05-46-53-462Z-3` is in the first exploration batch and returns with `find`, `grep`, and `exec_command` after ~8 s. That is not enough to explain +119 s median latency.
- CBM-on had zero `write_stdin` poll calls in project-instructions; off had 6 total. Polling made off cost worse, not on latency worse.
- CBM-on assistant-turn gaps are consistently longer: project-instructions on runs have median inter-assistant-start gaps ~14.4/15.6/14.9 s, while off runs are ~6.3/6.9/13.9 s. The excess is model deliberation/navigation time around a richer tool set and carried context, not shell/build wall-clock.

Conclusion: the +65% latency is an interaction effect: CBM-on gave the agent more structural options and more carried text, leading to slower deliberation despite fewer expensive off-arm context accidents.

## CBM tool-call catalogue and failure modes

Aggregate direct CBM calls:

| case | tool | calls | bytes total | median bytes | carry est. | usability |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| architecture | `codebase_memory` | 4 | 9,886 | 3,287 | 38,629 | 3 usable, 1 low-value/error-like |
| architecture | `read_symbol` | 24 | 60,624 | 1,627 | 173,135 | 24 returned source/snippet in 0.1.5; several over-large |
| architecture | `search_and_read_symbols` | 7 | 51,867 | 2,436 | 104,454 | 4 usable, 3 empty |
| architecture | `search_code` | 17 | 18,429 | 733 | 48,618 | 11 usable, 6 empty |
| config-scope | `read_symbol` | 1 | 946 | 946 | 12,744 | usable |
| config-scope | `search_and_read_symbols` | 7 | 51,233 | 3,990 | 344,832 | 6 usable, 1 empty |
| config-scope | `search_code` | 3 | 2,723 | 128 | 23,794 | 1 usable, 2 empty |
| project-instructions | `codebase_memory` | 3 | 12,821 | 2,889 | 47,036 | usable |
| project-instructions | `read_symbol` | 15 | 35,310 | 1,628 | 105,670 | returned source/snippet in 0.1.5 |
| project-instructions | `search_and_read_symbols` | 1 | 15,260 | 15,260 | 45,780 | usable but large |
| project-instructions | `search_code` | 10 | 5,607 | 452 | 15,160 | 6 usable, 4 empty |

Grep augmentation:

| case | augmented results | hits | empty | appended bytes | appended carry est. | failure mode |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| architecture | 3 | 1 | 2 | 2,967 | 3,242 | small; mostly empty |
| config-scope | 24 | 6 | 18 | 10,635 | 44,527 | many wasted `search_code` attempts on already adequate grep/exec results |
| project-instructions | 15 | 2 | 13 | 7,787 | 14,266 | mostly empty; latency budget risk, low token impact |

Failure modes observed:

1. **Over-fetch and duplication**: `search_and_read_symbols` returns a full candidate list plus `symbols[].symbol` metadata and snippets. This is visible in `services.ts:137-155` and every large usable result.
2. **Empty graph searches from glob/syntax mismatch**: examples include `file_pattern: "{packages,apps}/**/*.ts"` and malformed path filters. The extension passes patterns directly to CBM with no validation or syntax hint; 3/7 architecture `search_and_read_symbols` calls and 12/30 direct `search_code` calls were empty.
3. **Grep augmentation low hit-rate**: 33/42 augmented results were empty. The cost is small, but the extension spends CBM calls and up to 1.5 s per grep-like command.
4. **Large symbol reads**: `read_symbol` now works in 0.1.5, but default `max_symbol_lines` allows 220 lines. Some reads returned 9-10 KB and then rode many later requests.

### Per-call appendix

`carry est.` below is token-equivalent carry for the whole tool result row. For augmented `exec_command`, it is the whole command output carry; use the grep augmentation table above for appended-CBM-only carry.

| # | case | run suffix | req | tool | args | bytes | carry est. | status |
| ---: | --- | --- | ---: | --- | --- | ---: | ---: | --- |
| 1 | extension-architecture | 2026-09-03T20-03-44-801Z-3 | 3 | codebase_memory | `{"command":"get_architecture","arguments":{}}` | 3,287 | 22,167 | usable |
| 2 | extension-architecture | 2026-09-03T20-03-44-801Z-3 | 4 | search_and_read_symbols | `{"query":"FelanExtensionAPI FelanExtension extension config definition registerTool","file_pattern":"{packages,apps}/...` | 70 | 468 | empty |
| 3 | extension-architecture | 2026-09-03T20-03-44-801Z-3 | 5 | search_code | `{"pattern":"FelanExtensionAPI","path_filter":"packages/ apps/","limit":50,"context":3}` | 127 | 800 | empty |
| 4 | extension-architecture | 2026-09-03T20-03-44-801Z-3 | 8 | read_symbol | `{"file_path":"packages/agent-core/src/extensions.ts","name":"FelanExtensionAPI","max_symbol_lines":220}` | 1,274 | 6,996 | usable |
| 5 | extension-architecture | 2026-09-03T20-03-44-801Z-3 | 9 | read_symbol | `{"file_path":"packages/agent-core/src/extensions.ts","name":"FelanExtension","max_symbol_lines":220}` | 685 | 3,591 | usable |
| 6 | extension-architecture | 2026-09-03T20-03-44-801Z-3 | 12 | search_code | `{"pattern":"resolveBuiltinExtensionPackages","limit":20,"context":5}` | 870 | 3,924 | usable |
| 7 | extension-architecture | 2026-09-03T20-03-44-801Z-3 | 12 | search_code | `{"pattern":"loadFelanSessionExtensions","limit":30,"context":5}` | 677 | 3,042 | usable |
| 8 | extension-architecture | 2026-09-03T20-03-44-801Z-3 | 12 | search_code | `{"pattern":"builtinExtensions","limit":50,"context":4}` | 1,950 | 8,784 | usable |
| 9 | extension-architecture | 2026-09-03T20-03-44-801Z-3 | 12 | search_code | `{"pattern":"createAgentCoreSession","limit":30,"context":5}` | 1,857 | 8,352 | usable |
| 10 | extension-architecture | 2026-09-03T20-03-44-801Z-3 | 12 | search_code | `{"pattern":"registerTool","path_filter":"packages/ext-tasks/src/","limit":30,"context":5}` | 292 | 1,314 | usable |
| 11 | extension-architecture | 2026-09-03T20-03-44-801Z-3 | 13 | read_symbol | `{"file_path":"packages/agent-core/src/session.ts","name":"composeAgentCoreSession","max_symbol_lines":220}` | 3,264 | 13,872 | usable |
| 12 | extension-architecture | 2026-09-03T20-03-44-801Z-3 | 14 | read_symbol | `{"file_path":"packages/agent-core/src/session.ts","name":"CreateAgentCoreSessionOptions","max_symbol_lines":220}` | 1,738 | 6,944 | usable |
| 13 | extension-architecture | 2026-09-03T20-03-44-801Z-3 | 15 | read_symbol | `{"file_path":"apps/tui/src/runtime.ts","name":"createLocalSessionRuntimeFactory","max_symbol_lines":220}` | 9,711 | 36,420 | usable |
| 14 | extension-architecture | 2026-09-03T20-03-44-801Z-3 | 16 | search_and_read_symbols | `{"query":"resolveExtensionConfigSettings reads Felan settings extensionConfig and creates overrides","file_pattern":"...` | 11,075 | 38,766 | usable |
| 15 | extension-architecture | 2026-09-03T20-03-44-801Z-3 | 17 | read_symbol | `{"file_path":"apps/tui/src/settings.ts","name":"FelanSettings","max_symbol_lines":100}` | 873 | 2,834 | usable |
| 16 | extension-architecture | 2026-09-03T20-03-44-801Z-3 | 17 | read_symbol | `{"file_path":"apps/tui/src/settings.ts","name":"setBuiltinExtensionEnabled","max_symbol_lines":100}` | 1,028 | 3,341 | usable |
| 17 | extension-architecture | 2026-09-03T20-03-44-801Z-3 | 17 | read_symbol | `{"file_path":"apps/tui/src/settings.ts","name":"isBuiltinExtensionEnabled","max_symbol_lines":100}` | 758 | 2,470 | usable |
| 18 | extension-architecture | 2026-09-03T20-03-44-801Z-3 | 17 | read_symbol | `{"file_path":"apps/tui/src/cli-main.ts","name":"runCli","max_symbol_lines":220}` | 9,397 | 30,537 | usable |
| 19 | extension-architecture | 2026-09-03T20-03-44-801Z-3 | 21 | search_code | `{"pattern":"activeTools","path_filter":"packages/ apps/","limit":30,"context":4}` | 127 | 288 | empty |
| 20 | extension-architecture | 2026-09-03T20-03-44-801Z-3 | 22 | search_code | `{"pattern":"registerTool({","path_filter":"packages/","limit":50,"context":2}` | 1,836 | 3,672 | usable |
| 21 | extension-architecture | 2026-09-03T20-03-44-801Z-3 | 23 | read_symbol | `{"file_path":"packages/agent-core/src/runtime.ts","name":"AgentRuntime","max_symbol_lines":220}` | 1,650 | 2,884 | usable |
| 22 | extension-architecture | 2026-09-03T20-03-44-801Z-3 | 24 | search_code | `{"pattern":"setBuiltinExtensionEnabled","path_filter":"apps/tui/src/","limit":20,"context":4}` | 733 | 1,098 | usable |
| 23 | extension-architecture | 2026-09-03T20-08-46-637Z-4 | 3 | codebase_memory | `{"command":"get_architecture","arguments":{}}` | 3,287 | 8,210 | usable |
| 24 | extension-architecture | 2026-09-03T20-08-46-637Z-4 | 4 | read_symbol | `{"file_path":"packages/agent-core/src/extensions.ts","max_symbol_lines":220}` | 3,110 | 7,002 | usable |
| 25 | extension-architecture | 2026-09-03T20-08-46-637Z-4 | 4 | read_symbol | `{"file_path":"packages/agent-core/src/extension-config.ts","max_symbol_lines":220}` | 3,110 | 7,002 | usable |
| 26 | extension-architecture | 2026-09-03T20-08-46-637Z-4 | 4 | read_symbol | `{"file_path":"packages/agent-core/src/index.ts","max_symbol_lines":220}` | 3,110 | 7,002 | usable |
| 27 | extension-architecture | 2026-09-03T20-08-46-637Z-4 | 4 | read_symbol | `{"file_path":"apps/tui/src/extensions.ts","max_symbol_lines":220}` | 3,110 | 7,002 | usable |
| 28 | extension-architecture | 2026-09-03T20-08-46-637Z-4 | 4 | read_symbol | `{"file_path":"apps/tui/src/runtime-factory.ts","max_symbol_lines":220}` | 3,110 | 7,002 | usable |
| 29 | extension-architecture | 2026-09-03T20-08-46-637Z-4 | 4 | read_symbol | `{"file_path":"apps/tui/src/application.ts","name":"runLocalFelan","max_symbol_lines":220}` | 1,177 | 2,646 | usable |
| 30 | extension-architecture | 2026-09-03T20-08-46-637Z-4 | 5 | search_code | `{"pattern":"FelanExtensionAPI\|FelanExtension\|extensionConfig\|configDefinitions\|resolvedConfig","path_filter":"package...` | 278 | 560 | empty |
| 31 | extension-architecture | 2026-09-03T20-08-46-637Z-4 | 5 | search_code | `{"pattern":"registerTool","path_filter":"packages/\|apps/","limit":100,"context":4}` | 5,625 | 11,248 | usable |
| 32 | extension-architecture | 2026-09-03T20-08-46-637Z-4 | 5 | search_code | `{"pattern":"resolveBuiltinExtensionPackages\|createLocalExtensionImporter\|loadLocalExtensionConfigDefinitions","path_f...` | 278 | 560 | empty |
| 33 | extension-architecture | 2026-09-03T20-08-46-637Z-4 | 7 | search_and_read_symbols | `{"query":"Where are extension tools exposed to model context or active tools in Felan session composition?","file_pat...` | 21,868 | 32,802 | usable |
| 34 | extension-architecture | 2026-09-03T20-08-46-637Z-4 | 8 | search_code | `{"pattern":"setBuiltinExtensionEnabled","path_filter":"apps/","limit":20,"context":5}` | 834 | 1,040 | usable |
| 35 | extension-architecture | 2026-09-03T20-08-46-637Z-4 | 8 | search_code | `{"pattern":"isBuiltinExtensionEnabled","path_filter":"apps/","limit":20,"context":5}` | 1,049 | 1,310 | usable |
| 36 | extension-architecture | 2026-09-03T20-08-46-637Z-4 | 8 | search_code | `{"pattern":"builtinExtensions","path_filter":"apps/tui/README.md\|README.md\|docs/\|apps/tui/src/","limit":50,"context":4}` | 1,640 | 2,050 | usable |
| 37 | extension-architecture | 2026-09-03T20-10-43-010Z-5 | 3 | codebase_memory | `{"command":"get_architecture","arguments":{}}` | 3,287 | 8,210 | usable |
| 38 | extension-architecture | 2026-09-03T20-10-43-010Z-5 | 3 | search_and_read_symbols | `{"query":"FelanExtensionAPI extension config definition resolved config register tool","file_pattern":"{packages,apps...` | 70 | 180 | empty |
| 39 | extension-architecture | 2026-09-03T20-10-43-010Z-5 | 4 | search_code | `{"pattern":"FelanExtensionAPI","file_pattern":"{packages,apps}/**/*.ts","limit":50,"context":3}` | 128 | 288 | empty |
| 40 | extension-architecture | 2026-09-03T20-10-43-010Z-5 | 4 | search_code | `{"pattern":"ExtensionConfig","file_pattern":"{packages,apps}/**/*.ts","limit":50,"context":3}` | 128 | 288 | empty |
| 41 | extension-architecture | 2026-09-03T20-10-43-010Z-5 | 4 | read_symbol | `{"name":"loadLocalExtensionConfigDefinitions","file_path":"apps/tui/src/extensions.ts"}` | 1,603 | 3,609 | usable |
| 42 | extension-architecture | 2026-09-03T20-10-43-010Z-5 | 4 | read_symbol | `{"name":"resolveBuiltinExtensionPackages","file_path":"apps/tui/src/extensions.ts"}` | 1,288 | 2,898 | usable |
| 43 | extension-architecture | 2026-09-03T20-10-43-010Z-5 | 4 | read_symbol | `{"name":"importLocalExtension","file_path":"apps/tui/src/extensions.ts"}` | 840 | 1,890 | usable |
| 44 | extension-architecture | 2026-09-03T20-10-43-010Z-5 | 4 | read_symbol | `{"name":"createLocalExtensionImporter","file_path":"apps/tui/src/extensions.ts"}` | 4,075 | 9,171 | usable |
| 45 | extension-architecture | 2026-09-03T20-10-43-010Z-5 | 5 | read_symbol | `{"name":"runLocalFelan","file_path":"apps/tui/src/application.ts","max_symbol_lines":220}` | 1,177 | 2,352 | usable |
| 46 | extension-architecture | 2026-09-03T20-10-43-010Z-5 | 6 | codebase_memory | `{"command":"trace_path","arguments":{"from":"resolveBuiltinExtensionPackages","to":"createAgentSession","max_depth":8}}` | 25 | 42 | usable |
| 47 | extension-architecture | 2026-09-03T20-10-43-010Z-5 | 6 | exec_command | `{"cmd":"sed -n '1,260p' apps/tui/src/extensions.ts; printf '\\n--- likely wiring ---\\n'; grep -R -n -E 'resolveBuilt...` | 18,782 | 32,067 | aug-empty |
| 48 | extension-architecture | 2026-09-03T20-10-43-010Z-5 | 6 | search_and_read_symbols | `{"query":"registerTool extension tool call model tool definition","file_pattern":"packages/ext-ask-user/src/*.ts","li...` | 16,278 | 28,476 | usable |
| 49 | extension-architecture | 2026-09-03T20-10-43-010Z-5 | 7 | search_and_read_symbols | `{"query":"createLocalRootSessionRuntime loadFelanSessionExtensions extensionPackages importExtension","file_pattern":...` | 70 | 108 | empty |
| 50 | extension-architecture | 2026-09-03T20-10-43-010Z-5 | 7 | exec_command | `{"cmd":"sed -n '1,180p' packages/ext-ask-user/src/config.ts; printf '\\n--- ask index imports/export ---\\n'; sed -n ...` | 12,595 | 18,432 | aug-empty |
| 51 | extension-architecture | 2026-09-03T20-10-43-010Z-5 | 7 | search_and_read_symbols | `{"query":"createAgentCoreSession extensions inlineExtensions resourceLoader tools","file_pattern":"packages/agent-cor...` | 2,436 | 3,654 | usable |
| 52 | extension-architecture | 2026-09-03T20-10-43-010Z-5 | 8 | read_symbol | `{"name":"CapabilityCollector","file_path":"packages/agent-core/src/capabilities.ts"}` | 1,980 | 2,475 | usable |
| 53 | extension-architecture | 2026-09-03T20-10-43-010Z-5 | 8 | read_symbol | `{"name":"collectCapabilities","file_path":"packages/agent-core/src/capabilities.ts"}` | 1,579 | 1,975 | usable |
| 54 | extension-architecture | 2026-09-03T20-10-43-010Z-5 | 8 | read_symbol | `{"name":"formatCapabilitiesSection","file_path":"packages/agent-core/src/capabilities.ts"}` | 977 | 1,220 | usable |
| 55 | extension-architecture | 2026-09-03T20-10-43-010Z-5 | 9 | exec_command | `{"cmd":"grep -n 'export default' packages/ext-ask-user/src/index.ts packages/ext-*/src/index.ts \| head -50; grep -n -...` | 4,727 | 1,988 | aug-hit |
| 56 | extension-config-scope | 2026-09-04T06-04-35-882Z-0 | 3 | search_code | `{"pattern":"configField.","path_filter":"packages","file_pattern":"*.ts","regex":false,"context":3,"limit":100}` | 2,467 | 20,978 | usable |
| 57 | extension-config-scope | 2026-09-04T06-04-35-882Z-0 | 3 | search_and_read_symbols | `{"query":"ExtensionConfigFieldOptions resolveExtensionConfigs validateExtensionConfigDefinitions configField","file_p...` | 3,990 | 33,932 | usable |
| 58 | extension-config-scope | 2026-09-04T06-04-35-882Z-0 | 3 | search_and_read_symbols | `{"query":"resolveExtensionConfigSettings extensionConfig settings.json","file_pattern":"apps/tui/src/settings.ts","li...` | 11,311 | 96,152 | usable |
| 59 | extension-config-scope | 2026-09-04T06-04-35-882Z-0 | 4 | exec_command | `{"cmd":"sed -n '1,280p' packages/agent-core/src/extension-config.ts; printf '\\n--- index exports ---\\n'; grep -n \"...` | 18,410 | 146,388 | aug-hit |
| 60 | extension-config-scope | 2026-09-04T06-04-35-882Z-0 | 4 | exec_command | `{"cmd":"grep -RIn --include='*.ts' 'configField\\.' packages/*/src","workdir":"/home/dev/felan","yield_time_ms":10000...` | 8,765 | 69,795 | aug-empty |
| 61 | extension-config-scope | 2026-09-04T06-04-35-882Z-0 | 6 | exec_command | `{"cmd":"for f in $(grep -Rl --include='*.ts' 'configField\\.' packages/*/src \| grep -v 'agent-core/src/extension-conf...` | 81,714 | 630,881 | aug-empty |
| 62 | extension-config-scope | 2026-09-04T06-04-35-882Z-0 | 7 | exec_command | `{"cmd":"grep -RIl --include='*.ts' 'configField\\.' packages apps/tui \| sort","workdir":"/home/dev/felan","yield_time...` | 9,404 | 68,220 | aug-empty |
| 63 | extension-config-scope | 2026-09-04T06-04-35-882Z-0 | 8 | exec_command | `{"cmd":"grep -RIn --exclude-dir=node_modules --include='*.ts' -C 3 'configField\\.' apps/tui packages/*/test packages...` | 7,710 | 53,679 | aug-empty |
| 64 | extension-config-scope | 2026-09-04T06-04-35-882Z-0 | 12 | exec_command | `{"cmd":"python3 - <<'PY'\nfrom pathlib import Path\nfiles=[p for p in Path('packages').glob('ext-*/src/**/*.ts') if '...` | 5,465 | 32,250 | aug-empty |
| 65 | extension-config-scope | 2026-09-04T06-04-35-882Z-0 | 13 | exec_command | `{"cmd":"sed -n '250,380p' apps/tui/test/settings.test.ts; grep -RIn --exclude-dir=node_modules --include='*.ts' 'sens...` | 5,744 | 29,232 | aug-hit |
| 66 | extension-config-scope | 2026-09-04T06-04-35-882Z-0 | 16 | exec_command | `{"cmd":"grep -RIn --exclude-dir=node_modules --exclude-dir=dist --include='*.ts' -E \"^[[:space:]]*(type: '(string\|nu...` | 1,538 | 6,468 | aug-empty |
| 67 | extension-config-scope | 2026-09-04T06-04-35-882Z-0 | 32 | exec_command | `{"cmd":"grep -RIn 'scope' packages/ext-prewalk/dist/index.js packages/ext-ask-user/dist/config.js packages/ext-contex...` | 5,558 | 3,185 | aug-hit |
| 68 | extension-config-scope | 2026-09-04T06-04-35-882Z-0 | 32 | exec_command | `{"cmd":"grep -RIn --exclude-dir=node_modules --exclude-dir=dist 'getExtensionConfigCliOptions\\\|extensionConfigDefini...` | 1,750 | 1,620 | aug-empty |
| 69 | extension-config-scope | 2026-09-04T06-04-35-882Z-0 | 32 | search_and_read_symbols | `{"query":"extensionConfigDefinitions getExtensionConfigCliOptions BUILTIN_EXTENSIONS cli-main","file_pattern":"apps/t...` | 19,246 | 24,060 | usable |
| 70 | extension-config-scope | 2026-09-04T06-19-37-138Z-1 | 4 | search_code | `{"pattern":"configField.","file_pattern":"packages/*/src/**/*.ts","context":2,"limit":100,"max_symbol_lines":50}` | 128 | 1,728 | empty |
| 71 | extension-config-scope | 2026-09-04T06-19-37-138Z-1 | 4 | read_symbol | `{"name":"ExtensionConfigFieldOptions","file_path":"packages/agent-core/src/extension-config.ts","max_symbol_lines":220}` | 946 | 12,744 | usable |
| 72 | extension-config-scope | 2026-09-04T06-19-37-138Z-1 | 4 | search_and_read_symbols | `{"query":"resolveExtensionConfigSettings settings.json extensionConfig","file_pattern":"apps/tui/src/settings.ts","li...` | 9,843 | 132,894 | usable |
| 73 | extension-config-scope | 2026-09-04T06-19-37-138Z-1 | 5 | exec_command | `{"cmd":"sed -n '1,280p' packages/agent-core/src/extension-config.ts; printf '\\n--- index exports ---\\n'; grep -n \"...` | 20,599 | 264,099 | aug-hit |
| 74 | extension-config-scope | 2026-09-04T06-19-37-138Z-1 | 6 | exec_command | `{"cmd":"grep -RIl --include='*.ts' 'configField\\.' packages apps/tui/test \| sort; sed -n '50,90p' packages/agent-cor...` | 21,768 | 278,980 | aug-empty |
| 75 | extension-config-scope | 2026-09-04T06-19-37-138Z-1 | 7 | exec_command | `{"cmd":"sed -n '280,620p' apps/tui/test/settings.test.ts; grep -n -B3 -A8 'configField\\.' apps/tui/test/runtime.test...` | 10,439 | 129,183 | aug-empty |
| 76 | extension-config-scope | 2026-09-04T06-19-37-138Z-1 | 12 | exec_command | `{"cmd":"cat > /tmp/add-scopes.mjs <<'EOF'\nimport fs from 'node:fs';\nconst files = process.argv.slice(2);\nfor (cons...` | 10,994 | 122,912 | aug-empty |
| 77 | extension-config-scope | 2026-09-04T06-19-37-138Z-1 | 47 | search_and_read_symbols | `{"query":"extensionConfigDefinitions getExtensionConfigCliOptions cliMain","file_pattern":"apps/tui/src/**/*.ts","lim...` | 70 | 198 | empty |
| 78 | extension-config-scope | 2026-09-04T06-19-37-138Z-1 | 48 | exec_command | `{"cmd":"grep -RIn --include='*.ts' -E 'getExtensionConfigCliOptions\|extensionConfigDefinitions\|CONFIG_DEFIN' apps/tui...` | 14,548 | 35,230 | aug-empty |
| 79 | extension-config-scope | 2026-09-04T06-19-37-138Z-1 | 53 | exec_command | `{"cmd":"node <<'EOF'\nconst fs=require('fs'), cp=require('child_process');\nconst files=cp.execSync(\"grep -RIl --exc...` | 5,753 | 3,365 | aug-hit |
| 80 | extension-config-scope | 2026-09-04T06-33-29-491Z-2 | 3 | search_code | `{"pattern":"configField.","file_pattern":"packages/**/src/**/*.ts","context":4,"limit":100,"max_symbol_lines":80}` | 128 | 1,088 | empty |
| 81 | extension-config-scope | 2026-09-04T06-33-29-491Z-2 | 3 | search_and_read_symbols | `{"query":"resolveExtensionConfigSettings","file_pattern":"apps/tui/src/**/*.ts","limit":10,"read_limit":5,"max_symbol...` | 2,783 | 23,664 | usable |
| 82 | extension-config-scope | 2026-09-04T06-33-29-491Z-2 | 3 | search_and_read_symbols | `{"query":"ExtensionConfigFieldOptions resolveExtensionConfigs validateExtensionConfigDefinitions configField","file_p...` | 3,990 | 33,932 | usable |
| 83 | extension-config-scope | 2026-09-04T06-33-29-491Z-2 | 4 | exec_command | `{"cmd":"sed -n '1,260p' packages/agent-core/src/extension-config.ts; printf '\\n--- index exports ---\\n'; grep -n \"...` | 14,564 | 114,642 | aug-hit |
| 84 | extension-config-scope | 2026-09-04T06-33-29-491Z-2 | 4 | exec_command | `{"cmd":"find apps/tui/test -type f -maxdepth 2 -print \| sort; printf '\\n--- settings tests refs ---\\n'; grep -R -n ...` | 8,207 | 63,954 | aug-empty |
| 85 | extension-config-scope | 2026-09-04T06-33-29-491Z-2 | 4 | exec_command | `{"cmd":"find packages -path '*/src/*' -type f -name '*.ts' -print0 \| xargs -0 grep -nH 'configField\\.'","workdir":"/...` | 8,765 | 69,795 | aug-empty |
| 86 | extension-config-scope | 2026-09-04T06-33-29-491Z-2 | 5 | exec_command | `{"cmd":"for f in $(find packages -path '*/src/*' -type f -name '*.ts' -print0 \| xargs -0 grep -l 'configField\\.'); d...` | 52,646 | 418,688 | aug-empty |
| 87 | extension-config-scope | 2026-09-04T06-33-29-491Z-2 | 7 | exec_command | `{"cmd":"python3 - <<'PY'\nfrom pathlib import Path\nroots=[Path('packages'),Path('apps/tui/src'),Path('apps/tui/test'...` | 943 | 4,770 | aug-empty |
| 88 | extension-config-scope | 2026-09-04T06-33-29-491Z-2 | 9 | exec_command | `{"cmd":"python3 - <<'PY'\nfrom pathlib import Path\nfiles=[]\nfor root in [Path('packages'),Path('apps/tui/src'),Path...` | 12,105 | 82,600 | aug-empty |
| 89 | extension-config-scope | 2026-09-04T06-33-29-491Z-2 | 10 | exec_command | `{"cmd":"python3 - <<'PY'\nfrom pathlib import Path\nfiles=list(Path('apps/tui/test').rglob('*.ts'))\ndef matching(s,s...` | 3,142 | 19,143 | aug-empty |
| 90 | extension-config-scope | 2026-09-04T06-33-29-491Z-2 | 26 | exec_command | `{"cmd":"git status --short; git diff --check; git diff -- packages/agent-core/src/extension-config.ts packages/agent-...` | 14,175 | 38,137 | aug-empty |
| 91 | project-instructions | 2026-09-04T05-46-53-462Z-3 | 3 | codebase_memory | `{"command":"search_graph","arguments":{"query":"packages/agent-core session creation system prompt project instructio...` | 2,887 | 10,108 | usable |
| 92 | project-instructions | 2026-09-04T05-46-53-462Z-3 | 4 | read_symbol | `{"qualified_name":"home-dev-felan.packages.agent-core.src.session.createAgentCoreSession","max_symbol_lines":220}` | 878 | 2,860 | usable |
| 93 | project-instructions | 2026-09-04T05-46-53-462Z-3 | 4 | read_symbol | `{"qualified_name":"home-dev-felan.packages.agent-core.src.session.composeAgentCoreSession","max_symbol_lines":220}` | 2,961 | 9,620 | usable |
| 94 | project-instructions | 2026-09-04T05-46-53-462Z-3 | 4 | read_symbol | `{"qualified_name":"home-dev-felan.packages.agent-core.src.resource-loader.createAgentCoreResourceLoader","max_symbol_...` | 2,807 | 9,126 | usable |
| 95 | project-instructions | 2026-09-04T05-46-53-462Z-3 | 4 | read_symbol | `{"qualified_name":"home-dev-felan.packages.agent-core.src.runtime.AgentRuntime","max_symbol_lines":220}` | 1,628 | 5,291 | usable |
| 96 | project-instructions | 2026-09-04T05-46-53-462Z-3 | 5 | search_code | `{"pattern":"## Project\|Project instructions\|project instructions\|Current working directory:","file_pattern":"**/*.ts"...` | 129 | 384 | empty |
| 97 | project-instructions | 2026-09-04T05-46-53-462Z-3 | 5 | search_and_read_symbols | `{"query":"progressive context root instructions AGENTS CLAUDE formatting","file_pattern":"packages/**/*.ts","limit":2...` | 15,260 | 45,780 | usable |
| 98 | project-instructions | 2026-09-04T05-46-53-462Z-3 | 7 | exec_command | `{"cmd":"grep -R \"Current working directory:\\\|noContextFiles\\\|getAgentsFiles\" node_modules/.pnpm/@earendil-works+p...` | 3,588 | 8,210 | aug-empty |
| 99 | project-instructions | 2026-09-04T05-46-53-462Z-3 | 8 | exec_command | `{"cmd":"grep -R \"function buildSystemPrompt\\\|agentsFiles\" node_modules/.pnpm/@earendil-works+pi-coding-agent@0.84....` | 2,586 | 5,130 | aug-empty |
| 100 | project-instructions | 2026-09-04T05-46-53-462Z-3 | 9 | search_code | `{"pattern":"runtime.readFile(","file_pattern":"packages/agent-core/src/*.ts","limit":30,"context":3}` | 641 | 1,280 | usable |
| 101 | project-instructions | 2026-09-04T05-46-53-462Z-3 | 9 | read_symbol | `{"qualified_name":"home-dev-felan.packages.agent-core.src.host-agent-runtime.HostAgentRuntime.readFile","max_symbol_l...` | 1,222 | 2,448 | usable |
| 102 | project-instructions | 2026-09-04T05-46-53-462Z-3 | 9 | exec_command | `{"cmd":"cat packages/agent-core/tsconfig.json packages/agent-core/tsconfig.build.json && grep -R \"agentsFilesOverrid...` | 9,314 | 18,016 | aug-empty |
| 103 | project-instructions | 2026-09-04T05-46-53-462Z-3 | 10 | exec_command | `{"cmd":"grep -n \"function loadProjectContextFiles\\\|CONTEXT_FILES\" packages/agent-core/node_modules/@earendil-works...` | 2,829 | 4,417 | aug-empty |
| 104 | project-instructions | 2026-09-04T05-46-53-462Z-3 | 15 | search_code | `{"pattern":"createAgentCoreResourceLoader(","file_pattern":"**/*.ts","limit":50,"context":2}` | 616 | 308 | usable |
| 105 | project-instructions | 2026-09-04T05-52-08-512Z-4 | 3 | codebase_memory | `{"command":"search_graph","arguments":{"query":"Agent Core session creation system prompt AgentRuntime resource loade...` | 2,889 | 12,274 | usable |
| 106 | project-instructions | 2026-09-04T05-52-08-512Z-4 | 4 | read_symbol | `{"qualified_name":"home-dev-felan.packages.agent-core.src.session.createAgentCoreSession","max_symbol_lines":220}` | 878 | 3,520 | usable |
| 107 | project-instructions | 2026-09-04T05-52-08-512Z-4 | 4 | read_symbol | `{"qualified_name":"home-dev-felan.packages.agent-core.src.session.composeAgentCoreSession","max_symbol_lines":220}` | 2,961 | 11,840 | usable |
| 108 | project-instructions | 2026-09-04T05-52-08-512Z-4 | 4 | read_symbol | `{"qualified_name":"home-dev-felan.packages.agent-core.src.resource-loader.createAgentCoreResourceLoader","max_symbol_...` | 2,807 | 11,232 | usable |
| 109 | project-instructions | 2026-09-04T05-52-08-512Z-4 | 4 | read_symbol | `{"qualified_name":"home-dev-felan.packages.agent-core.src.runtime.AgentRuntime","max_symbol_lines":220}` | 1,628 | 6,512 | usable |
| 110 | project-instructions | 2026-09-04T05-52-08-512Z-4 | 6 | search_code | `{"pattern":"Current working directory","path_filter":"packages/agent-core","context":5,"limit":20}` | 287 | 1,008 | usable |
| 111 | project-instructions | 2026-09-04T05-52-08-512Z-4 | 6 | search_code | `{"pattern":"Project instructions","path_filter":"packages/agent-core","context":5,"limit":20}` | 127 | 448 | empty |
| 112 | project-instructions | 2026-09-04T05-52-08-512Z-4 | 6 | exec_command | `{"cmd":"grep -nEi 'system.?prompt\|AGENTS\|CLAUDE\|working directory\|context' packages/agent-core/test/session.test.ts p...` | 3,378 | 10,752 | aug-empty |
| 113 | project-instructions | 2026-09-04T05-52-08-512Z-4 | 7 | search_code | `{"pattern":"readFile(","path_filter":"packages/agent-core/src","context":3,"limit":30}` | 1,359 | 4,420 | usable |
| 114 | project-instructions | 2026-09-04T05-52-08-512Z-4 | 7 | exec_command | `{"cmd":"grep -Rsn \"Project instructions\\\|Current working directory:\\\|agentsFilesOverride\\\|getAgentsFiles\" node_m...` | 25,706 | 3,924,401 | aug-empty |
| 115 | project-instructions | 2026-09-04T05-52-08-512Z-4 | 7 | exec_command | `{"cmd":"grep -Rsn \"noContextFiles\\\|agentsFilesOverride\" node_modules/.pnpm/@earendil-works+pi-coding-agent@0.84.0*...` | 15,982 | 926,783 | aug-empty |
| 116 | project-instructions | 2026-09-04T05-52-08-512Z-4 | 9 | exec_command | `{"cmd":"sed -n '60,125p' packages/agent-core/src/runtime.ts && grep -Rsn \"new TextDecoder\\\|TextDecoder\" packages/a...` | 3,239 | 8,063 | aug-empty |
| 117 | project-instructions | 2026-09-04T05-52-08-512Z-4 | 9 | read_symbol | `{"qualified_name":"home-dev-felan.packages.agent-core.src.host-agent-runtime.HostAgentRuntime.readFile","max_symbol_l...` | 1,222 | 3,366 | usable |
| 118 | project-instructions | 2026-09-04T05-52-08-512Z-4 | 12 | read_symbol | `{"qualified_name":"home-dev-felan.packages.agent-core.src.host-agent-runtime.HostAgentRuntime","max_symbol_lines":180}` | 7,300 | 14,600 | usable |
| 119 | project-instructions | 2026-09-04T05-52-08-512Z-4 | 13 | exec_command | `{"cmd":"sed -n '1,100p' apps/tui/src/system-prompt.ts && grep -Rsn \"loadLocalAppendSystemPrompt\\\|loadLocalChildSyst...` | 2,203 | 3,059 | aug-empty |
| 120 | project-instructions | 2026-09-04T05-52-08-512Z-4 | 17 | exec_command | `{"cmd":"grep -Rsn \"runtime.readFile(\" packages/agent-core/test packages/agent-core/README.md README.md \| head -40 &...` | 4,988 | 1,692 | aug-hit |
| 121 | project-instructions | 2026-09-04T05-58-56-797Z-5 | 3 | codebase_memory | `{"command":"search_graph","arguments":{"query":"packages/agent-core session creation system prompt project instructio...` | 7,045 | 24,654 | usable |
| 122 | project-instructions | 2026-09-04T05-58-56-797Z-5 | 4 | search_code | `{"pattern":"project instructions\|Current working directory\|current-working-directory\|AGENTS.md\|CLAUDE.md","path_filte...` | 128 | 416 | empty |
| 123 | project-instructions | 2026-09-04T05-58-56-797Z-5 | 4 | read_symbol | `{"qualified_name":"home-dev-felan.packages.agent-core.src.session.composeAgentCoreSession","max_symbol_lines":220}` | 2,961 | 9,620 | usable |
| 124 | project-instructions | 2026-09-04T05-58-56-797Z-5 | 4 | read_symbol | `{"qualified_name":"home-dev-felan.packages.agent-core.src.resource-loader.createAgentCoreResourceLoader","max_symbol_...` | 2,807 | 9,126 | usable |
| 125 | project-instructions | 2026-09-04T05-58-56-797Z-5 | 4 | read_symbol | `{"qualified_name":"home-dev-felan.packages.agent-core.src.runtime.AgentRuntime","max_symbol_lines":160}` | 1,628 | 5,291 | usable |
| 126 | project-instructions | 2026-09-04T05-58-56-797Z-5 | 5 | search_code | `{"pattern":"FELAN_BASE_SYSTEM_PROMPT","path_filter":"packages/agent-core/src","context":5,"limit":20}` | 833 | 2,496 | usable |
| 127 | project-instructions | 2026-09-04T05-58-56-797Z-5 | 5 | search_code | `{"pattern":"readFile(","path_filter":"packages/agent-core/src","context":3,"limit":50}` | 1,359 | 4,080 | usable |
| 128 | project-instructions | 2026-09-04T05-58-56-797Z-5 | 6 | exec_command | `{"cmd":"grep -R \"getAgentsFiles\\\|noContextFiles\\\|agentsFilesOverride\" node_modules/.pnpm/@earendil-works+pi-codin...` | 4,070 | 9,944 | aug-empty |
| 129 | project-instructions | 2026-09-04T05-58-56-797Z-5 | 6 | exec_command | `{"cmd":"cat packages/agent-core/src/system-prompt.ts && grep -R \"Project instructions\\\|project instructions\\\|Curre...` | 4,966 | 12,815 | aug-empty |
| 130 | project-instructions | 2026-09-04T05-58-56-797Z-5 | 7 | search_code | `{"pattern":"TextDecoder","path_filter":"packages/agent-core/src","context":3,"limit":20}` | 128 | 320 | empty |
| 131 | project-instructions | 2026-09-04T05-58-56-797Z-5 | 8 | exec_command | `{"cmd":"grep -R \"runtime.cwd\" packages/agent-core/src -n && sed -n '1,150p' packages/agent-core/src/extensions.ts &...` | 10,708 | 17,010 | aug-hit |
| 132 | project-instructions | 2026-09-04T05-58-56-797Z-5 | 8 | exec_command | `{"cmd":"grep -R \"agentsFilesOverride\" packages apps -n --include='*.ts' \|\| true; grep -R \"projectInstructions\" pa...` | 19,410 | 42,984 | aug-empty |
| 133 | project-instructions | 2026-09-04T05-58-56-797Z-5 | 9 | exec_command | `{"cmd":"git log -S'AGENTS.md' --oneline --all -- packages/agent-core/src && git log -S'agentsFilesOverride' --oneline...` | 431 | 864 | aug-empty |
| 134 | project-instructions | 2026-09-04T05-58-56-797Z-5 | 14 | read_symbol | `{"qualified_name":"home-dev-felan.packages.agent-core.src.host-agent-runtime.HostAgentRuntime.constructor","max_symbo...` | 1,622 | 1,218 | usable |
## Bug status in `packages/ext-codebase-memory/src/`

| issue | status in 0.1.5 | evidence | impact now |
| --- | --- | --- | --- |
| `read_symbol` qualified-name path cannot parse grouped `search_graph` envelopes | **Fixed** | Architecture workspace `services.ts:168-188` supports `record.groups` via `searchGroupedCandidates()`, mapping `qn_prefix`, group `file`, and row `name` into `qualified_name`. Older config-scope workspace 0.1.2 still lacks this at `services.ts:162-170`. | Not a rev2 cost cause for architecture/project runs; still explains older 0.1.2 workspaces and any runtime pinned to that source. |
| `read_symbol` name + `file_path` filters on `candidate.file_path` while real result column is `file` | **Fixed** | 0.1.5 architecture workspace `services.ts:121` uses `candidate.file ?? candidate.file_path`; older config-scope 0.1.2 uses only `candidate.file_path` at `services.ts:115`. | Rev2 `read_symbol` returns snippets; no longer source=0. |
| `search_and_read_symbols` candidate/snippet duplication | **Present** | 0.1.5 architecture workspace `services.ts:139-155`: `limit: params.limit ?? 20`, reads only `candidates.slice(0, readLimit)`, then returns `{ project, candidates, symbols }`; `symbols` embeds `symbol: candidate`. | Direct measurable cost: 15 calls, 118,360 B results, ~495k carried token-equivalents. |
| Sequential snippet reads in `search_and_read_symbols` | **Present** | 0.1.5 `services.ts:149-153` awaits each `get_code_snippet` inside a loop. | Latency risk; each call can serialize up to 12 MCP requests. |
| Grep augmentation fires on every parsed grep-like command and appends mostly empty/noisy searches | **Present** | `grep-augmentation.ts:22-51` handles every stored grep result; `:29-36` calls `search_code`; `:45` suppresses empty appends, but the CBM query still ran. | 42 augmentation attempts, 33 empty; small token cost, avoidable latency/tool work. |
| Tool schemas/instructions add fixed prompt overhead | **Present by design** | `index.ts:14` capability paragraph; `tools.ts:27-132` registers four tools with schemas/descriptions. | +508 first-request tokens in clean off/on pairs; cheap but deterministic. |
| `client.ts` result parser only reads first text block from MCP envelope | **Potential new correctness/efficiency issue** | `client.ts:317-324` uses `result.content.find(...)` rather than all text blocks. The benchmark tool results from Felan can have `content[]`; no multi-text CBM MCP response was observed here. | Low current risk; if CBM emits multiple text blocks, data can be silently dropped. |

## Ranked implementation fixes

1. **Make `search_and_read_symbols` compact by default**
   Evidence: `services.ts:137-155`. Change return shape to omit full `candidates` by default, or return only unread candidates after the read set, and avoid repeating `symbols[].symbol` fields already present in candidate metadata. Keep an opt-in `include_candidates`/debug mode if needed.
   Projected saving: 30-50% of `search_and_read_symbols` payload. In this corpus, that is roughly 150k-250k carried token-equivalents across 9 CBM-on runs (~0.5-2% total prompt tokens; larger on tasks that use this tool early). No latency downside.

2. **Parallelize snippet fetches in `search_and_read_symbols`**
   Evidence: `services.ts:149-153` serial `await` loop. Use bounded `Promise.all` over the selected candidates, preserving output order.
   Projected saving: latency only. For calls with `read_limit` 6-12, worst-case MCP snippet latency becomes max latency instead of sum latency. Likely seconds per large call; low cost impact.

3. **Reduce default read volume**
   Evidence: `tools.ts:7` sets `max_symbol_lines` default 220; `services.ts:198-214` bounds only by line count. Use lower defaults for read tools, e.g. 120 for `read_symbol` and 80-120 for `search_and_read_symbols`, with explicit override up to 220. Consider also bounding bytes/chars because generated/minified long lines can evade line limits.
   Projected saving: 15-35% of direct CBM payload carry in this corpus when agents do not need whole long functions; roughly 140k-330k carried token-equivalents. Risk: truncating needed context, so expose clear override.

4. **Gate grep augmentation**
   Evidence: `grep-augmentation.ts:22-51`; observed 42 attempts with 33 empty. Only augment when the original command output is empty, truncated, or likely broad/ambiguous; skip when the command already returned focused file/line matches; optionally disable augmentation after repeated empty hits in a session.
   Projected saving: only ~62k carried token-equivalents here, but up to 42 avoided MCP calls and up to 1.5 s attempted deadline each. Biggest benefit is latency/noise, especially config-scope.

5. **Validate and explain supported pattern syntax**
   Evidence: empty calls with `file_pattern: "{packages,apps}/**/*.ts"` and broad malformed `path_filter` strings. Add schema descriptions/examples or normalize simple brace patterns into multiple searches if CBM does not support brace globs. Return a short warning when a pattern is unsupported instead of an empty result indistinguishable from no matches.
   Projected saving: prevents dead-end CBM calls and follow-up raw searches. In this corpus: 15 empty direct CBM calls plus 33 empty augmentations; cost small, behavioral value high.

6. **Shorten capability/tool descriptions once behavior is stable**
   Evidence: `index.ts:14`, `tools.ts:29-120`.
   Projected saving: bounded at the fixed preamble, ~508 tokens/request now. Across these 9 CBM-on runs, about 67k prompt tokens (<1% cost). Do after larger payload fixes.

7. **Parse all MCP text blocks in `client.ts`**
   Evidence: `client.ts:317-324`. Change to concatenate or otherwise handle all `result.content` text blocks, matching the analysis rule used for Felan tool results.
   Projected saving: correctness/robustness, not current measured cost. Prevents partial responses from forcing retry/fallback raw searches if future CBM responses split content.

## Bottom line

Rev2 shows CBM is no longer catastrophically broken: `read_symbol` works in the 0.1.5 source/runtime path. But the extension still spends too many tokens on verbose structural payloads and too much latency on low-hit automatic augmentation. The highest-impact concrete fixes are compact `search_and_read_symbols`, parallel snippet reads, lower/byte-bounded defaults, and gated grep augmentation.
