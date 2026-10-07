# Work Fleet roadmap

## Implemented slice

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
synthetic fixtures do not supply live proof. A modern hosted transport remains a
separate verified integration, not an inferred local CLI capability.
The addon is private at version 0.0.0 until the maintainer chooses a release; packed
consumer validation still covers its archive. No existing package version changes.
