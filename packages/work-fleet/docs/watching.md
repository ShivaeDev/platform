# Wait and watch streams

`work-fleet wait` and `work-fleet watch` follow the daemon's stored Fleet state. This page describes what each stream prints, how it reconnects and how it deduplicates. The [README](../README.md#follow-work-as-it-moves) covers everyday use and the event kinds.

## Where the snapshots come from

`wait` and `watch` each use one scoped RPC subscription. The daemon is the only store writer. Record and foreign-occupancy writes run through sql `transact` and record table hints inside that transaction. Fleet record commits notify followers through PostgreSQL, including followers in another host runtime, and a listener resync refreshes their stored-state snapshots.

The daemon shares one summary stream across followers. It subscribes to committed record hints before reading compact fields through its receipt connection, then reads again only when a record commit arrives; it does not poll PostgreSQL. New followers receive the last good snapshot; after the last follower leaves, the next subscription starts with a fresh read.

PostgreSQL read failures retain the last good snapshot and retry every half second; 20 consecutive failed attempts end all current followers with a clear message and exit 1.

## Reconnection

A reconnect receives a snapshot of the original selected set, or all items for `watch --follow` without IDs; printed outcomes remain deduplicated.

`watch --follow` writes an `ERROR` line to stderr on each failed connection attempt, including before its first snapshot, then retries at `--interval` without an attempt limit. Each retry rereads the port file, so a restarted daemon can change ports. Other wait and watch subscriptions retry connection loss up to 20 consecutive attempts before exit 1. `--timeout <seconds>` exits 4 and writes a timeout message to stderr.

## The event stream

`work-fleet watch` does not read the generated status Markdown. Its first snapshot establishes a baseline without replaying existing transitions. Each later transition prints once.

The daemon sends a heartbeat every second. Three seconds without a stream item reconnects the subscription. The event watcher checks the daemon's `/live` HTTP route independently with a one-second deadline; the route uses no database or provider calls. Probes run sequentially, with a half-second pause after a completed check. Failed probes retry four times after delays of 2, 4, 8 and 16 seconds, rereading the port file on every attempt. Five failed attempts print `daemon-unreachable` once after about 30–35 seconds; recovery prints `daemon-back` once. A ten-second daemon stall produces neither health event. With `--json`, these are JSON objects with the corresponding `kind`. Stalled provider work or stream delivery leaves a responsive daemon quiet. Both health events bypass `--events`.

Watch reconnects at `--interval` seconds (default 0.5), rereading the Board's port file each time. A new daemon instance, including a supervisor restart on the same port, prints the health pair and establishes a fresh baseline without replaying historical transitions.

Routine heartbeats are off; `--heartbeat SECONDS` opts into a quiet-period `heartbeat` line for the combined stream.

## Board answers

The JSON watch emits `board-answer` once per response from someone other than the orchestrator observed after the watch starts, including questions outside running Fleet work. It skips the orchestrator responses recorded by Fleet release and answer commands. It names the registered `question`, `request`, `reason`, `author`, `responseId`, Board `item`, and `unblocks`; `workId` is the first unblocked item, or the question's item when it has no explicit unblock target. Reconnecting to the daemon retains the response identities already emitted.

## Pull request events

`--pr-events` watches the PR links in Fleet snapshots through the pr-watch engine. PR lines use the same `kind` field: `pr-dequeued` (with `reason`), `pr-stuck`, `pr-conflict`, `pr-auto-merge-off`, `pr-merged` and `pr-closed`. They include `repository`, `number`, `pr` and `workId`.

Targets are grouped by repository. Completed Fleet work adds no targets. Only open PRs enter the watch; each stays watched through the first poll that sees it merged or closed. New Fleet PRs join as snapshots arrive.

`--pr-interval` sets the GitHub polling interval in seconds (default 60); `--api-url` selects the REST base. Authentication uses `GH_TOKEN`, then `GITHUB_TOKEN`. Snapshots live under `<board>/.pr-watch/OWNER-REPO.json` and retain pr-watch's restart delivery limits.

A PR-specific failure emits `pr-error` once per distinct error while other PRs keep reporting. Non-retryable refusals such as HTTP 422 back off before that PR is read again. Repository-wide transient GitHub failures retry; pacing emits `pr-cooldown`. A repository-wide fatal failure prints `pr-error` and `pr-stopped` before the command exits unsuccessfully. `--events` filters transition kinds while daemon and PR health changes remain visible.

## Outcomes for selected items

With positional IDs and without event flags (`--json`, `--events`, `--pr-events` or a positive `--heartbeat`), `watch <ids...>` prints text outcomes and exits 0 after every selected item reports done, waiting or released. Duplicate IDs report once; unknown IDs remain pending.

`watch --follow` keeps running even when no work is active or every item has reported. With no IDs, it watches all items, including items launched later; explicit IDs restrict it to those items. Its first snapshot reports current waits and records done or released history without printing it, then it prints one line when an item enters done, waiting or released.

Human waits include the owner and reason; a reviewed PR ready for a human merge is a wait on the maintainer. A new decision prints again, even if its reason is unchanged. An item that leaves waiting for repair and returns with the same reason reports again. Repeated snapshots of the same outcome do not print again. Reconnecting after a daemon restart preserves those states: unchanged history stays quiet, and an outcome that changed during the gap prints once. Stop the follower with Ctrl-C, or set an explicit `--timeout`.

`watch --follow` accepts unfamiliar decision codes, stages and extra fields from a newer daemon. It prints unfamiliar codes and stages as text; an entry whose display fields cannot decode prints its raw data without stopping other entries or later snapshots. Fatal watch errors exit 1 and print one cause line on stderr.
