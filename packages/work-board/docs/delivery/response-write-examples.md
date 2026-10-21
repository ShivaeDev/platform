# Local response contract

Questions capture exact reviewed source bytes and path. Independent response Markdown retains human direction, while explicit write opt-in and browser-local drafts keep reading and publication separate. The [README](../../README.md#record-a-human-response) teaches the commands and the source/filesystem limits.

## One real loop

An agent records an explicit open attention request in `investigation.md`, then reads it with `work-board question investigation.model/review-model`. The command returns the full source, reason, generation ID and reviewed SHA-256 without writing or starting a deadline. `work-board wait investigation.model/review-model --revision <reviewedRevision>` registers that exact generation and waits.

The person reviews the investigation, chooses **Respond to this request**, previews “Use explicit requests; preserve unknown evidence”, then records it. Question and response records are readable source files; the original investigation is unchanged. The wait returns one attributable JSON question/response with exit 0. If the shell was killed, repeating `work-board wait <question-id>` retrieves the same reply. No agent launcher, scheduler, acknowledgment protocol or verified acceptance is implied.

## Source records

A question file has `id`, `kind: question` and `question` frontmatter. `question` contains `item`, `request`, `source`, `reviewedRevision`, `reason`, `registeredAt` and `deadline` (milliseconds). Its body preserves the exact original source bytes used for the hash. Generation identity includes item, request, reviewed hash and source path. The request and literal response-from labels follow the [attention rules](./attention-examples.md); no owner/status inference is introduced.

A response has `id` and `response` frontmatter, with `question`, `reviewedRevision`, `author`, `type` (`answer`, `clarify`, `not_now`) and `recordedAt`. Its body is the authored Markdown. The label is local attribution, not authentication. An answer can say no; exit 0 means receipt of a reply, not approval. Recorded feedback remains distinct from criterion-level verified acceptance.

## Failure and recovery

A source change/rename during drafting preserves the text and shows the revision change. Previewing again binds a new response identity to the new reviewed generation; an old saved response never approves that new context. A changed source after the final check cannot be locked against every unrelated editor; records therefore retain the exact reviewed bytes rather than claiming a multi-file transaction or overwriting the editor's source.

Publication runs on Linux and macOS with supported hard links/fsync; see the README for the macOS path-based limits. Read-only operation remains available elsewhere. New files publish without replacement; same-ID retries reconcile exact content. Moved/duplicated/conflicting identities, permission failures and changed/symlinked write boundaries are rejected. After a post-publication failure, an uncertain result retains the draft. Reconcile saved identity/content and directory synchronization before confirming a retry.

Browser drafts use effect-form persistence keyed by workspace, item and request, a 256 KiB bound per draft, seven days after edit and explicit current-form clearing. Saved source has no implicit retention deletion. A 48-hour unanswered deadline starts at durable registration; rearming/page visits do not reset it. It returns a distinct nonzero unanswered result, leaves the request intact, and permits a late reply. Service outages never establish that a person left it unanswered.

The [ownership boundary](./source-editing-examples.md) keeps ordinary project editing with agents; a passive question wait is a reader for the agent's own harness.
