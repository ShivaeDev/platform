# D2: approved local response boundary

On 6 October 2026 the maintainer approved the draft-store and per-question wait
research recommendation and authorized implementation. Work Board 0.8.0 uses
separate immutable question/context and response Markdown files, explicit local
write opt-in, reviewed source bytes/path and re-readable per-question results.
Exact current commands, fields, source trust and filesystem limits are documented
in the [package README](../../../README.md#local-responses-and-one-logical-wait-per-question).

## One real loop

An agent records an explicit open attention request in `investigation.md`, then
reads it with `work-board question investigation.model/review-model`. The command
returns the full source, reason, generation ID and reviewed SHA-256 without writing
or starting a deadline. `work-board wait investigation.model/review-model
--revision <reviewedRevision>` registers that exact generation and waits.

The person reviews the investigation, chooses **Respond to this request**, previews
“Use explicit requests; preserve unknown evidence”, then records it. Question and
response records are readable source files; the original investigation is unchanged.
The wait returns one attributable JSON question/response with exit 0. If the shell
was killed, repeating `work-board wait <question-id>` retrieves the same reply.
No agent launcher, scheduler, acknowledgment protocol or verified acceptance is implied.

## Current source records

A question file has `id`, `kind: question` and `question` frontmatter. `question`
contains `item`, `request`, `source`, `reviewedRevision`, `reason`, `registeredAt`
and `deadline` (milliseconds). Its body preserves the exact original source bytes
used for the hash. Generation identity includes item, request, reviewed hash and
source path. The request and literal response-from labels still follow D1 attention
rules; no owner/status inference is introduced.

A response has `id`, `kind: response` and `response` frontmatter, with `question`,
`reviewedRevision`, `author`, `type` (`answer`, `clarify`, `not_now`) and `recordedAt`.
Its body is the authored Markdown. The label is local attribution, not authentication.
An answer can say no; exit 0 means receipt of a reply, not approval. Recorded
feedback remains distinct from criterion-level verified acceptance.

## Failure and recovery

A source change/rename during drafting preserves the text and shows the revision
change. Previewing again binds a new response identity to the new reviewed
generation; an old saved response never approves that new context. A changed
source after the final check cannot be locked against every unrelated editor;
records therefore retain the exact reviewed bytes rather than claiming a
multi-file transaction or overwriting the editor's source.

Publication requires Linux directory descriptors and supported hard links/fsync.
Read-only operation remains available elsewhere. New files publish without
replacement; same-ID retries reconcile exact content. Moved/duplicated/conflicting
identities, permission failures and changed/symlinked write boundaries are rejected.
After a post-publication failure, an uncertain result retains the draft. Reconcile
saved identity/content and directory synchronization before confirming a retry.

Browser drafts are separate from Mark seen: one 2 MiB bound per workspace/origin,
30 days after edit, explicit clearing and expiry/storage failure disclosure.
Saved source has no implicit retention deletion. A 48-hour unanswered deadline
starts at durable registration; rearming/page visits do not reset it. It returns
a distinct nonzero unanswered result, leaves the request intact, and permits a
late reply. Service outages never establish that a person left it unanswered.

## Remaining gates

D3 still covers an actual agent handoff/acknowledgment adapter before step 18.
A CLI wait in an existing harness does not establish automatic model wakeup,
launch an agent. Step 16's rich decision contract is delivered; the later
[ownership decision](./source-editing-examples.md) keeps ordinary project editing
with agents and defers direct editing/undo. No special agent writer is required.
D4 before step 24 and the pending representative-reader/device evidence remain.

## Repeatable acceptance path

Run `pnpm ready` for native types, regressions, the real local PostgreSQL suites
and packed consumers. Start the production CLI against a disposable Linux folder
with an explicit attention request and `--responses`. Open Respond, enter a draft,
reload, and modify the proposal externally. The draft must survive and require a
new preview. Start concurrent `wait <item>/<request> --revision <hash>` commands;
restart the server at the same port, kill and reattach one waiter, then record a
reply. Every successful stdout result must name the same question generation and
attributable reply. Repeating the wait must not consume it. Compare the original
source bytes and inspect the independent Markdown records.

Delay a successful response acknowledgment while typing another draft. Release
it and reload: the later text must remain under a fresh response identity.
Check narrow dark/reduced-motion layout and saved reply reading without JavaScript.
For resources, sample `/proc/<pid>/smaps_rollup`, CPU ticks and descriptors for 20
registered idle waiters over five seconds, without concurrent repository handoff.
Report PSS separately from summed RSS; neither a short idle observation nor an
edited test deadline proves a 48-hour soak or automatic harness wakeup.
