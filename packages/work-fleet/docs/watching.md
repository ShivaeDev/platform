# Wait and watch streams

`work-fleet wait` and `work-fleet watch` follow the daemon's stored Fleet state. This page describes what each stream prints, how it reconnects and how it deduplicates. The [README](../README.md#follow-work-as-it-moves) covers everyday use and the event kinds.

## Where the snapshots come from

`wait` and `watch` each use one scoped RPC subscription. The daemon is the only store writer. Record and foreign-occupancy writes run through sql `transact` and record table hints inside that transaction. Fleet record commits notify followers through PostgreSQL, including followers in another host runtime, and a listener resync refreshes their stored-state snapshots.

The daemon shares one summary stream across followers. It subscribes to committed record hints before reading compact fields through its receipt connection, then reads again only when a record commit arrives; it does not poll PostgreSQL. New followers receive the last good snapshot; after the last follower leaves, the next subscription starts with a fresh read.

PostgreSQL read failures retain the last good snapshot and retry every half second; 20 consecutive failed attempts end all current followers with a clear message and exit 1.

## Reconnection

A reconnect receives a snapshot of the original selected set, or all items for `watch --follow` without IDs; printed outcomes remain deduplicated.

Continuous watches reconnect at `--interval` without an attempt limit and reread the port file, so a restarted daemon can change ports. `--timeout <seconds>` exits 4. Outcome subscriptions retry connection loss up to 20 consecutive attempts before exit 1.

## The event stream

`work-fleet watch` does not read the generated status Markdown. The default prints current actionable waits and failures, then each distinct actionable event once per work item, head and reason. Repeated decisions with the same reason stay quiet across later passes, repair and reconnection. `--all` and explicit `--events` selections establish a baseline without replaying existing transitions.

The daemon sends a heartbeat every second. Three seconds without a stream item reconnects the subscription. The event watcher checks the daemon's `/live` HTTP route independently with a one-second deadline; the route uses no database or provider calls. Probes run sequentially, with a half-second pause after a completed check. Failed probes retry four times after delays of 2, 4, 8 and 16 seconds, rereading the port file on every attempt. With `--all` or `--events`, five failed attempts print `daemon-unreachable` once after about 30–35 seconds; recovery prints `daemon-back` once. The default holds this notification for a further minute and discards the pair if the daemon recovers during that interval. A ten-second daemon stall produces neither health event. With `--json`, these are JSON objects with the corresponding `kind`. Stalled provider work or stream delivery leaves a responsive daemon quiet. Both health events bypass explicit `--events` selections.

Watch reconnects at `--interval` seconds (default 0.5), rereading the Board's port file each time. A new daemon instance, including a supervisor restart on the same port, prints the health pair with `--all` or `--events`; brief restarts stay quiet by default. Actionable event deduplication survives daemon restarts.

Routine heartbeats are off; `--heartbeat SECONDS` opts into a quiet-period `heartbeat` line for the combined stream.

## Board answers

`--all` or `--events board-answer` emits `board-answer` once per response from someone other than the orchestrator observed after the watch starts, including questions outside running Fleet work. It skips the orchestrator responses recorded by Fleet release and answer commands. It names the registered `question`, `request`, `reason`, `author`, `responseId`, Board `item`, and `unblocks`; `workId` is the first unblocked item, or the question's item when it has no explicit unblock target. Reconnecting to the daemon retains the response identities already emitted.

## Pull request events

PR monitoring is enabled by default; `--pr-events false` disables it. The watcher follows the PR links in Fleet snapshots, including release PRs holding changeset PRs, through the pr-watch engine. PR lines use the same `kind` field: `pr-dequeued` (with `reason`), `pr-stuck`, `pr-conflict`, `pr-auto-merge-off`, `pr-merged` and `pr-closed`. They include `repository`, `number`, `pr`, `workId` and the observed `head` when available. The default selects conflicts, stuck queues, closed PRs and queue removals for failures; `--all` also includes merges and auto-merge changes.

Targets are grouped by repository. Completed Fleet work adds no targets. Tracked PRs are reconciled on startup, including a merge or closure that happened while the watcher was stopped. Open PRs stay watched through the first poll that sees them merged or closed; saved terminal snapshots stay quiet on restart. New Fleet PRs and held release PRs join as snapshots arrive. Release events carry the work ID of a held item; a release leaving the merge queue emits `pr-dequeued` with its reason just like a work PR.

`--pr-interval` sets the GitHub polling interval in seconds (default 60); `--api-url` selects the REST base. Authentication uses `GH_TOKEN`, then `GITHUB_TOKEN`. Snapshots live under `<board>/.pr-watch/OWNER-REPO.json` and retain pr-watch's restart delivery limits.

A failed queue confirmation preserves the previous snapshot without emitting transitions until confirmation succeeds. A PR-specific non-retryable failure emits `pr-error` once per distinct error while other PRs keep reporting. Recoverable 5xx, timeout, transport and retry-after failures stay quiet by default; `--all` includes their diagnostics. Non-retryable refusals such as HTTP 422 back off before that PR is read again. Repository-wide transient GitHub failures retry; pacing emits `pr-cooldown` with `--all`. A repository-wide fatal failure prints `pr-error` before the command exits unsuccessfully; `--all` also prints `pr-stopped`. `--events` filters transition kinds while daemon and PR health changes remain visible.

## Outcomes for selected items

With positional IDs and without event flags (`--follow`, `--all`, `--json`, `--events`, `--pr-events` or a positive `--heartbeat`), `watch <ids...>` prints text outcomes and exits 0 after every selected item reports done, waiting or released. Duplicate IDs report once; unknown IDs remain pending.

`watch --follow` selects the continuous event stream for all or selected items. It keeps running when no work is active. Human waits name the owner and reason; automation waits remain quiet. Stop with Ctrl-C, or set an explicit `--timeout`.
