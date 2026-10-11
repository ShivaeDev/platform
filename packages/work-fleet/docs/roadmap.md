# Work Fleet roadmap

## Implemented slice

Approved report tasks use `fleet-deliverable: report`. The worker returns its whole report in the final message; Fleet records an immutable Board result with the task relationship and exact session/turn provenance, then completes without PR adoption, review, checks or delivery. Empty output needs a human. PostgreSQL and Markdown host regressions cover completion, empty output, status and wait; a lost-publication regression recovers the existing attempt after restart without a duplicate result or worker. Provider execution in these regressions is synthetic.

The CLI host collects new uncommitted text and binary files from the exact Cloud task turn's backend diff and saves them beside the Board result. Terminal report turns and publication retries check the configured GitHub remote; the exact worker branch or an opened PR blocks completion without deleting public evidence. PostgreSQL host regressions use an authenticated synthetic task HTTP backend and paginated synthetic GitHub responses to cover attachments, no attachments, branch and PR rejection, and worker questions after publication. Filesystem regressions cover immutable retries and symlink boundaries. These fixtures do not establish live Cloud task identity compatibility or GitHub authentication; live hosted attachment retrieval remains part of the pilot.

The headless addon reads stable Board identities and dependencies. Ordinary
PostgreSQL attachments hold preparation, ownership, attempts, acknowledged turns,
review/check evidence, decisions and accepted outcomes. Completion is attached to
the Board ID in SQL; Fleet does not rewrite the authored task status in Markdown.

The core provides prepare/dispatch/reconcile, native RPC commands and derived
Active, Completed and Needs human queries. Independent review, repair and validation
precede trusted delivery or evidenced no-change. Scope, execution capacity, quota
and delivery backlog remain separate. Recovery retains ambiguous operations and
accepted ownership instead of relaunching blindly. Renewal keeps the same Board ID
and archives prior context, attempts, responses and evidence after confirming terminal
execution and resolving existing result ownership. Current dependency revisions
need fresh accepted outcomes; criterion-specific references remain unsupported.

Completed worker and repair turns that report the explicit question marker publish ordinary Board questions. A current answer commits a response receipt and continuation intent together, then continues the same worker thread. Concurrent resolution, restart and lost acknowledgements reconcile the existing operation without repeated submission. Open questions return the CLI's needs-human exit code. Unmarked prose is not classified as a question.

Published decisions retain exact Board question/context receipts. Reconciliation
consumes current guided retry/release responses and records idempotent SQL
acknowledgements. Native resolution names the work, decision and response IDs.
Clarification, deferral, stale context and competing unsuperseded answers remain
concrete human blockers. Response labels and bodies cannot grant runtime authority.
Applied responses retain the exact published decision and Board acknowledgement
marker in SQL. After SQL resolution commits, the Markdown gateway publishes a
qualified immutable request receipt, allowing Board's native attention to acknowledge
the managed request without modifying its reviewed source. Failed publication retries
without repeating the action. Renewal recovers the exact decision publication receipt
from stored original context before archival; missing context blocks renewal.
archived open decisions retain pending acknowledgement state and receive superseded
acknowledgements. Clarification and deferral stay open.

Preparation compatibility uses authoritative ancestry and complete relevant context.
Unrelated changes refresh preparation while preserving original validation evidence;
relevant or uncertain changes require preparation again for the affected work.

## Validation boundary

The CLI host publishes an optional `fleet/status.md` heading board with Active, Needs human and Done columns. Renderer tests cover card grouping, links and unsafe Markdown inputs; filesystem tests cover unchanged writes, authored content and symlink boundaries. PostgreSQL scheduler tests cover completion, human intervention, suspended validation and publication retry, including invalidation of a mounted native Board page over real HTTP. These fixtures use synthetic provider and delivery integrations; they do not establish a live Cloud worker or physical-browser acceptance.

The host reads GitHub checks and commit statuses for the adopted PR head through `gh`. Synthetic paginated GitHub responses cover green, red, pending and newer-push cases, and PostgreSQL fixtures cover pending recovery and repair prompts. These fixtures prove the integration's SHA binding and validation transitions; they do not prove live GitHub authentication, branch requirements or delivery. No-change validation requires a separate runtime implementation.

Focused regressions exercise ordinary PostgreSQL transactions, real Board HTTP
response recording, native Fleet RPC and the actual admission/completion paths.
Provider execution and delivery in those fixtures are synthetic. These tests prove
the core decisions and recovery behavior, not Cloud execution or live merges.
The experimental local Codex adapter is based on the installed CLI's generated
protocol and a real app-server connection. Two read-only local turns were accepted
and their exact receipts recovered after reconnecting without another launch. Both
ended in provider authentication failure; the actual quota read also failed with
401. This proves receipt/recovery behavior, not successful computation, Fleet
admission under fresh quota, automatic replacement or delivery.

## Personal pilot follow-up

- Configure working provider access, authoritative quota and trusted delivery policy.
- Run at least two disjoint Board items through the headless host.
- One independently reviewed, validated routine outcome progressing automatically.
- Replacement timing and occupancy observations after confirmed terminal execution.
- Restart adoption without a duplicate launch using exact accepted receipts.
- Normal authorized delivery under actual branch requirements.
- A verified modern hosted Cloud transport/configuration if hosted execution is wanted.

The maintainer will verify this live loop in a personal pilot after the environment's
checks. Missing credentials and hosted capabilities remain concrete pilot blockers;
synthetic fixtures do not supply live proof. The Cloud WebSocket adapter and headless host have PostgreSQL SIGKILL coverage around thread and turn mutations, including recovery of 100 concurrent attempts with lost turn acknowledgements. An unacknowledged thread cannot be located by operation ID with the current protocol, so it remains blocked with ownership retained. Provider lookup for that case and live hosted restart evidence remain pending.
The addon is private at version 0.0.0 until the maintainer chooses a release; packed
consumer validation still covers its archive. No existing package version changes.
