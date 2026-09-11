# Session Compaction benchmark

This benchmark compares native Pi compaction with Felan's
`@felan-ai/ext-session-compaction` on the same real coding trajectory.

## Input

The fixture is the first 234 entries of local Felan session
`01a042ca-0d42-75eb-aeac-0397822915e2`, immediately before its first historical
native compaction. The session contains real implementation work for the
harness-evals public-results archive: 10 patch attempts (8 successful and 2
failed), one file write, publication and CLI work, task-state transitions,
failures and fixes, and a final 129-test verification.

The trajectory includes a useful state change. An AWS SDK and S3 adapter were
initially added, then the user chose filesystem-first storage with Supabase or
Vercel Blob deferred. A faithful checkpoint must preserve the later decision
instead of reviving the superseded design.

The copied prefix retains its real assistant usage of 217,549 tokens. With a
60,000-token reserve and 20,000 recent tokens, current Pi recreates the original
`8fa87dbb` cut: 149 messages are summarized and the recent suffix remains in
context. No synthetic message or usage watermark is added.

`fixture.json` records the source-session hash, raw-prefix hash, sanitized hash,
entry count, byte size, and historical boundary. Sanitization removes provider
reasoning/text signatures and response IDs, maps the original repository root
to `/workspace`, redacts other home paths and URL query values, and rejects
recognized credential patterns. The historical compaction and all later entries
are excluded so each arm must create exactly one new checkpoint.

## Arms and scoring

- `felan-no-session-compaction`: native Pi summary path.
- `felan-inherit-compaction`: verified Felan summary path with the
  `sessionCompaction.model` setting omitted, exercising its `inherit` default.

Both arms use `openai-codex/gpt-5.6-sol` for the active session, low thinking,
identical Pi cut settings, and Codex post-agent compaction disabled. The
candidate must report `requestedModel: inherit` and use the active
`openai-codex/gpt-5.6-sol` model. After the evaluated container exits, the
project adapter atomically writes the host-held expected owner into run-local
config for the verifier. The candidate therefore cannot pass with native
fallback, and the baseline cannot pass with extension-owned compaction.

The hidden verifier records two numeric rewards:

- `summaryFidelity`: goal, filesystem-first decision, superseded AWS/S3 state,
  future provider direction, public-data boundary, provider separation, batch
  state, and work pending at the cut.
- `continuationFidelity`: latest storage state, implemented publication surface,
  public artifacts, immutability and filesystem safety, recorded verification,
  and a concrete black-box end-to-end publication plan.

Required facts and minimum coverage apply to both sections. The rubric is a
fact ledger derived from source entry IDs, not the historical Pi summary. The
continuation prompt is adapted from the actual next user request but forbids
tools because the source checkout is intentionally absent.

The adapter adds successful `compaction_end.result.usage` to assistant
`message_end` usage. This includes the summary request in cumulative cost and
token totals without estimating prices locally.

## Live run

The benchmark requires six provider-backed attempts and is intentionally not
executed during offline validation. After refreshing the managed image to the
latest Felan release, run:

```bash
bun run run --benchmark session-compaction --concurrency 1
```

Record the resolved Felan release with retained results. Do not replace this
fixture with generated `.harness-evals` output or publish unsanitized sessions.
