# Work Fleet roadmap

## Built

- The `work-fleet` command loads `fleet.config.json`, schedules approved Board work with `run`, explicitly dispatches an item, reports stored views with `status`, and observes outcomes with `wait`. Host tests cover admission and revision approval against PostgreSQL; CLI tests cover status flags and wait process exit codes.
- Board frontmatter uses `fleet: approved` and per-field `fleet-launch` overrides. Host launch defaults and task overrides reach worker sessions and turns; repair retains the settings. Frontmatter, host and launch-setting tests cover these boundaries.
- The Codex Cloud provider sends the configured environment and launch settings, confirms the environment before a turn and rejects work prepared for a different workspace, reads final output, and refreshes expired login files through a configured command. `src/providers/codexCloud.test.ts` covers these requests and failures with a synthetic WebSocket backend.
- Worker instructions include Cloud startup waiting, current-main checkout, repository checks and one human-review pull request. The report parser recognizes a URL or explicit no-change marker. `src/prompt/worker.test.ts` covers these instructions and parsing.
- The Effect core stores preparation, attempts, receipts, review/check evidence, decisions and accepted outcomes in PostgreSQL. Native RPC and derived views, revision-bound completion, repair, dependency acceptance, renewal and recovery are exercised by the engine tests. Overlapping scopes can dispatch concurrently; admission tests cover capacity, quota and backlog separately.
- Managed Board decisions retain exact question/context receipts. Current guided retry/release responses resolve idempotently in SQL, and immutable Board request receipts acknowledge applied or superseded decisions. HTTP and renewal tests cover publication recovery and stale or ambiguous responses.
- The command host reads GitHub check runs and commit statuses for the adopted PR's exact SHA through `gh`. Pending checks keep validation open and failures reach repair. `src/host/githubChecks.test.ts` and `src/engine/validation.spec.ts` cover these transitions with synthetic GitHub responses.
- The local Codex adapter connects to an independently owned app-server. `src/providers/codexLocal.test.ts` covers receipts, reconnect, explicit interruption and observation-scope closure with a synthetic backend.

## Open for the command host

- Result adoption: verify and attach the actual pull request or evidenced no-change result. A worker report marker alone is insufficient.
- Independent review and repair: wire the core's exact-head review and reconciliation boundary to a real reviewer.
- Authorized delivery: supply trusted authorization, delivery observation and normal merge under branch requirements.
- Board view: present Fleet execution attachments and decisions in the Board interface.

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

The command host's default integrations read GitHub checks but do not supply result adoption, review or delivery. The PostgreSQL host-loop test reaches Needs human after a terminal worker when adoption is unavailable. Completion tests use injected synthetic integrations; they prove the core path, not these open host integrations.

## Validation boundary

Real PostgreSQL tests cover durable storage, host admission, status reads, wait process behavior and engine transitions. Board HTTP tests exercise response and acknowledgement publication. Synthetic paginated GitHub responses cover green, red, pending and newer-push checks; they do not prove live GitHub authentication or branch requirements. Cloud and local provider tests use synthetic WebSocket servers. Packed consumers exercise the package exports and command help.

Live Cloud computation, actual pull request adoption, independent review, required checks and authorized delivery still need end-to-end evidence. A terminal turn, a report URL and accepted delivery are separate facts. No synthetic fixture supplies live proof.

## Maintainer decisions

- Release and public distribution: the package remains private at version `0.0.0`.
- Live pilot: validate disjoint work, replacement timing, restart recovery and normal delivery once the open host integrations are connected.
