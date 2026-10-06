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
accepted ownership instead of relaunching blindly.

Preparation compatibility uses authoritative ancestry and complete relevant context.
Unrelated changes refresh preparation while preserving original validation evidence;
relevant or uncertain changes require preparation again for the affected work.

## Validation boundary

Focused regressions exercise ordinary PostgreSQL transactions and the actual Fleet
admission/completion paths with synthetic provider and delivery integrations. These
prove the core decisions and recovery behavior, not Cloud execution or live merges.
The experimental local Codex adapter is based on the installed CLI's generated
protocol and a real app-server connection. Actual authenticated computation and
normal delivery still require a runtime with working credentials and trusted policy.

## Required before accepting the live loop

- A bounded run of at least two disjoint Board items using working provider access.
- One independently reviewed, validated routine outcome progressing automatically.
- Replacement timing and occupancy observations after confirmed terminal execution.
- Restart adoption without a duplicate launch using exact accepted receipts.
- Normal authorized delivery under actual branch requirements.
- A verified modern hosted Cloud transport/configuration if hosted execution is wanted.

These remain concrete capability blockers rather than simulated completion claims.
The addon is private at version 0.0.0 until the maintainer chooses a release; packed
consumer validation still covers its archive. No existing package version changes.
