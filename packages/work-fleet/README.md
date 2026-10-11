# @shivaedev/work-fleet

Work Fleet launches approved Work Board items and keeps execution receipts in PostgreSQL. Use its command to schedule workers and inspect progress, or compose its Effect services with your own result, validation and delivery integrations.

## Keep approved work moving

Approve an item in Board, then let Fleet admit it and observe its worker. Waiting views name who must act: the maintainer, the orchestrator or automation. The host tests exercise this loop without launching an external worker.

```sh
work-fleet serve <board-dir>
```

## Use the command

Board owns authored work and its revision. Fleet stores preparation, attempts and outcomes against that identity in PostgreSQL. A terminal worker turn is execution evidence; accepted completion also needs result adoption, independent review, checks and an observed human merge of the reviewed head, or validated no-change. The core tests exercise those completion paths with synthetic integrations.

### Configure the host

Put `fleet.config.json` in the Board folder. `--config <file>` selects another configuration file. A Cloud host needs both `cloud` and `worker` settings:

```json
{
  "provider": "cloud",
  "cloud": {
    "environmentId": "<environment-config-id>",
    "cwd": "<workspace-path>"
  },
  "worker": {
    "branchPrefix": "<branch-prefix>",
    "sharedEnvironment": "<environment-script-path>"
  },
  "database": {
    "url": "<postgresql-url>"
  },
  "launch": {
    "model": "<model>",
    "effort": "<reasoning-effort>",
    "serviceTier": "<service-tier>"
  }
}
```

Replace the placeholders with trusted host settings. `cloud.environmentId` identifies the Cloud environment configuration, and `cloud.cwd` identifies its workspace. The Cloud transport confirms the returned environment before starting a turn. It rejects work prepared for a different workspace and rejects an echoed service tier that differs from the requested tier. `worker` supplies the branch prefix and environment script path used in the generated worker instructions.

Set optional `worker.workerGuidance` to repository-specific worker instructions. It accepts inline text or `{ "file": "worker.md" }` with the same validation as `worker.reviewerGuidance`; file paths resolve from the Board folder. An unreadable file fails host policy creation. Fleet includes the text in every worker prompt, including first turns, review and check repairs, manual continuations and report corrections. When unset, Fleet adds no worker guidance.

Set optional `worker.reviewerGuidance` to repository-specific review instructions. It accepts inline text or `{ "file": "reviewer.md" }`; file paths resolve from the Board folder. An unreadable file fails host policy creation. The host includes the text in initial reviewer prompts and verdict follow-ups. Omitted guidance leaves the default prompt repository-independent.

For this repository, configure the `worker` section in `.work/fleet.config.json` with the Platform guidance:

```json
{
  "worker": {
    "branchPrefix": "<branch-prefix>",
    "sharedEnvironment": "<environment-script-path>",
    "reviewerGuidance": "To check that PostgreSQL tests are not skipped without job logs, read .github/workflows/ci.yml at the reviewed head and follow its test job database setup and environment configuration. In this repository, pnpm db:setup provisions PostgreSQL and pnpm test supplies PLATFORM_EFFECT_*_TEST_DATABASE_URL through script/test.ts and script/lib/postgres-test-environment.ts. Inspect those files at the same head; the checkout may differ."
  }
}
```

The host defaults to `concurrency: 100`, `backlog: 100`, `namespace: "work_fleet"`, `quota: "codex"` and an empty `launch`. `concurrency` limits execution; `backlog` limits undelivered adopted changes. The Codex quota policy uses ordinary-usage eligibility and caches observations for a minute; `quota: "unlimited"` admits without that provider limit. An unknown quota response fails rather than granting capacity.

Missing or invalid configuration fails. Configuration and Cloud request tests are in `src/host/config.test.ts`, `src/host/guidance.test.ts`, `src/engine/workerGuidance.spec.ts`, `src/engine/reportCorrection.spec.ts`, `src/host/quota.test.ts` and `src/providers/codexCloud.test.ts`; they prove parsing, worker and reviewer guidance propagation and synthetic provider behavior, not live Cloud computation.

Scheduler dispatch submits prepared items in sequence and stops the pass after a definite request-queue-full rejection. Worker and repair launches wait up to one second for acknowledgement after persisting their intent; missing replies retain execution ownership while the pass continues dispatching. The provider request continues in the service scope so late replies are persisted, and reconciliation waits for that request to finish before recovering the operation. Explicit caller interruption still cancels the submission. Rejected work stays prepared, releases execution capacity and retries on later passes with durable exponential backoff from 30 seconds up to five minutes. The waiting item is tried before the rest of the prepared backlog, so provider capacity backoff also pauses that backlog. `work-fleet status` shows waiting for provider capacity with the last rejection time and next retry time. Other definite rejections still require a human decision; ambiguous submissions retain their existing ownership for reconciliation. A retry after an explicitly rejected first turn reuses the acknowledged thread. PostgreSQL tests with synthetic providers in `src/engine/launchPacing.spec.ts`, `src/engine/launchBackpressure.spec.ts` and `src/engine/workerContinuation.spec.ts` cover acknowledgement pacing, late replies, recovery, interruption, capacity backoff and thread reuse.

### Start the local daemon

`work-fleet serve <board-dir>` binds to `127.0.0.1:3457`; `--port <port>` selects another port. The daemon composes `Fleet.layer`, the host and scheduler once for its lifetime. Its HTTP clients share one PostgreSQL pool, bounded by `database.maxConnections` (20 by default), and one provider connection set. Work Board runs independently.

Native Effect HTTP RPC uses NDJSON at `/_fleet/rpc`. Import `DaemonContract` from `@shivaedev/work-fleet/host/daemonContract.ts` and provide `RpcClient.layerProtocolHttp` with `RpcSerialization.layerNdjson` and an HTTP client. The contract exposes Fleet's existing prepare, dispatch, continue, reconcile, resolve, reassign, get and views operations, plus `daemon.dispatch` for explicit Board preparation and dispatch, `daemon.status` for filtered views and the `daemon.follow` snapshot stream. Platform's `RequestTracing` supplies a request id for each call, preserving valid `x-request-id` values. Only loopback Host values and missing or same-origin transport Origin headers are accepted; requests must use `application/ndjson`.

Compose `daemonLayer(host, parts, port)` in a scoped host, or launch it with `serveFleet(host, parts, port)`, both from `@shivaedev/work-fleet/host/daemon.ts`. The listener starts before scheduling. Closing the scope stops scheduling and HTTP, then closes the provider services and pool. Restart recovery reuses saved launch intents and acknowledged threads; an unacknowledged thread retains uncertain ownership for human inspection. The PostgreSQL and real HTTP tests in `src/host/daemon.test.ts` cover a completed item, concurrent clients, pool/provider lifetime and request ids. `src/host/cloudRestart.spec.ts` kills and restarts the daemon at launch boundaries against a synthetic Cloud backend without creating a second thread or accepted turn. These tests do not launch live Cloud workers.

### Approve work and override launch settings

Set the exact `fleet: approved` value in the item's frontmatter. Missing approval or `fleet: draft` does not approve it. The optional `fleet-launch` object overrides host `launch` settings per field:

```yaml
---
id: <work-id>
kind: task
fleet: approved
fleet-launch:
  model: <model>
  effort: <reasoning-effort>
  serviceTier: <service-tier>
---
```

The launch fields are strings. Omitted fields inherit the host settings; without host settings or an override, they inherit provider defaults. An invalid override fails before dispatch. The selected settings also apply to repair turns. `src/board/fleetField.test.ts`, `src/host/commands.test.ts` and `src/engine/launchSettings.spec.ts` cover these rules.

### Schedule areas and dependencies

Use `areas` to name the code areas a task changes. Area names are exact shared labels, such as `work-fleet/host`; they do not expand into filesystem paths. Fleet admits one task per area, while disjoint areas and tasks without areas can run concurrently within the existing capacity and quota limits.

```yaml
---
id: task.follow-up
kind: task
fleet: approved
areas: [work-fleet/host, work-board/ui]
relationships:
  - kind: depends_on
    target: task.foundation
---
# Add the follow-up behavior
```

An overlapping task remains prepared, waiting on automation, with a reason such as `waiting for area work-fleet/host held by task.foundation`. Areas are held through execution, review and validation, and are freed on completion or safe release. For a reviewed, green PR ready for a human merge, `areaMergeWaitMs` in Fleet policy or `fleet.config.json` defaults to `1800000` (30 minutes), counted from that readiness event. Once the wait expires, other tasks can use its areas while Fleet continues observing the PR for delivery. PostgreSQL preserves admission order across restarts; eligible overlapping tasks wait behind earlier prepared work.

Fleet identifies work by its authored brief: the Markdown title and body, criteria, Board kind, deliverable kind and authored relationships. Bookkeeping fields such as `status`, `next_action` and `owner` do not change that revision. Editing them on executing or reviewing work preserves the attempts; editing them on work with an open decision preserves the question and its recorded answers. Criteria or body edits still stop the work with a Board context changed decision. Approval remains a separate execution requirement. `src/board/briefRevision.test.ts`, `src/engine/briefBookkeeping.spec.ts` and `briefChanges.spec.ts` cover the revision rule, restart and decision resolution with real PostgreSQL and synthetic providers.

A `depends_on` relationship waits on the orchestrator for an accepted Fleet outcome on the target's current brief revision: an observed merge or validated no-change completion. Bookkeeping edits on the target preserve that acceptance before dispatch and while dependents execute, review or wait on a decision. Changes to the target's authored brief still need a new accepted outcome. If the target has no Fleet record, its authored `status: done` also qualifies. A prepared, released or unfinished Fleet record does not qualify through Board status alone. Missing or ambiguous targets and criterion-specific references remain blocked. Status, wait timeout summaries and the generated Board view show the stored reason. Real PostgreSQL regressions in `src/engine/areaScheduling.spec.ts`, `areaMergeWait.spec.ts`, `areaDeliveryObservation.spec.ts`, `dependencyScheduling.spec.ts`, `dependencies.spec.ts`, `dependencyBookkeeping.spec.ts`, `dependencyDecisionBookkeeping.spec.ts` and `src/host/schedulingViews.spec.ts` cover admission, release, ordered restart, dependency acceptance and those views with synthetic provider integrations.

### Run, dispatch and inspect

| Command | Behavior |
|---|---|
| `work-fleet serve <board-dir> [--port <port>]` | Starts the local HTTP RPC daemon, admits approved work, dispatches prepared items and reconciles running work. |
| `work-fleet dispatch <work-id> [--port <port>]` | Prepares and dispatches one approved item; explicit dispatch can re-approve an edited revision. |
| `work-fleet status [--port <port>]` | Prints Active, owner-grouped waiting and Completed views from stored records. |
| `work-fleet status <work-id> --json [--port <port>]` | Filters to one item and prints the views as JSON. |
| `work-fleet release <work-id>... --board <board-dir>` | Releases terminal needs-human items and records closing responses on their Board decisions. |
| `work-fleet reassign <work-id> <decision-id> <owner> --board <board-dir>` | Reassigns the exact current question to maintainer, orchestrator or automation. |
| `work-fleet wait <work-id> --timeout <seconds> [--port <port>]` | Subscribes to daemon snapshots until an outcome or timeout. |
| `work-fleet watch [work-ids...] [--port <port>]` | Follows several items in one process and reports each outcome once. |
| `work-fleet name-threads --board <board-dir>` | Names existing Cloud threads from Fleet records and reports each rename or failure. |

Automatic admission does not re-approve an edited item that already has a record. Explicit dispatch reads the current approved revision; renewal still requires safe execution and result ownership. Keep `serve` active to reconcile worker progress. `status`, `dispatch`, `wait` and `watch` connect to its loopback port (3457 by default) over RPC and open no PostgreSQL connection. Their retained `--board` and `--config` flags do not select a host; the running daemon owns its Board and configuration. Without a daemon, they exit 1 with the address and a command to start it. The host loop and approval behavior are exercised against PostgreSQL in `src/host/commands.test.ts`; `src/host/statusProcess.spec.ts` exercises status output and flags.

`wait` prints a summary and exits with these codes:

| Code | Meaning |
|---|---|
| `0` | Completed. |
| `1` | Error, including an unavailable daemon. |
| `2` | Waiting on the named owner. |
| `3` | Released. |
| `4` | The requested timeout expired. |

`--interval <seconds>` controls reconnect delay and defaults to 15. An item not yet recorded keeps waiting. `src/host/wait.test.ts` exercises the actual process, terminal summaries, timeout and delayed creation against PostgreSQL over HTTP. `src/host/watchFailures.spec.ts` covers each command's missing-daemon message.

`watch` prints one line per item when that item is completed, needs-human or released, then exits 0 after every item has reported. Duplicate IDs report once; unknown IDs remain pending. With no IDs, it follows the active items found by its first successful read and exits when those items have reported. Existing completed, needs-human and released items are excluded from that initial active set. `wait` and `watch` each use one scoped RPC subscription. The daemon shares one summary stream across followers, reading compact fields through its existing pool every half second only while at least one follower is subscribed. New followers receive the last good snapshot; after the last follower leaves, the next subscription starts with a fresh read. PostgreSQL read failures retain the last good snapshot and retry every half second; 20 consecutive failed attempts end all current followers with a clear message and exit 1. A reconnect receives a snapshot of the original selected set; printed outcomes remain deduplicated. Connection loss retries up to 20 consecutive attempts before exit 1. `--timeout <seconds>` exits 4 and writes a timeout message to stderr. `src/host/watch.test.ts`, `src/host/daemonClients.spec.ts`, `src/host/snapshotStream.test.ts` and `src/host/daemonFollow.spec.ts` cover output, HTTP restart resync, initial selection, PostgreSQL read recovery and failure bounds, and the poller subscription lifecycle.

### Read the generated heading board

The CLI host writes `fleet/status.md` inside the Board folder. It derives Active, Waiting on maintainer, Waiting on orchestrator, Waiting on automation and Done columns from the same Fleet views, with one card per current unreleased item, retaining released items while a blocker remains. Cards link to the task's Board identity and its adopted PR when available. The file contains execution stages and blockers, not worker prompts, session receipts or authored task status.

After the first scheduler cycle creates the file, select it as Work Board's home:

```sh
work-board ./notes --home fleet/status.md
```

The host refreshes the view on scheduler reads and after preparation, dispatch, reconciliation, reassignment and resolution. Work Board's existing file watcher refreshes an open page. Identical content leaves the file untouched. Publication failures are reported and retried on the next cycle without changing execution outcomes. The writer refuses authored content or symlinks at the generated destination. Board remains usable without Fleet; the generated file is an optional projection of SQL records. A composed headless runtime can opt into the same publication behavior by providing `statusLayer(boardRoot)` from `@shivaedev/work-fleet/host/statusLayer.ts` over its Fleet Layer and Node filesystem services. `src/board/statusMarkdown.test.ts`, `src/board/writeStatus.test.ts` and `src/host/statusLayer.test.ts` cover rendering, file boundaries and publication retry.

### Identify who must act

Waiting records and views carry `attentionOwner`: `maintainer` for scope decisions or merging a reviewed PR, `orchestrator` for routine worker questions, result inspection and retry, and `automation` for missing host integrations, occupied capacity or pending checks. `FleetViews.waiting` contains separate `maintainer`, `orchestrator` and `automation` arrays. Items with blockers also appear in waiting groups while retaining their stage, including released work awaiting a Board acknowledgement. `work-fleet status`, its JSON output and the generated Board views use these groups; wait and watch summaries name the owner while retaining their exit codes.

Reassign the exact current question with `fleet.reassign(workId, decisionId, attentionOwner)`, the native `Reassign` RPC command, or the CLI:

```sh
work-fleet reassign sample-task sample-decision maintainer --board ./notes
```

Retrying the original decision ID for the same committed reassignment recovers publication and acknowledgement without creating another question; a competing change reports a typed stale decision. Legacy waits keep the maintainer as the recipient of their published question, and reconciliation reads a recorded answer before changing an owner. `src/engine/legacyAttention.spec.ts` and `src/engine/reassignRecovery.spec.ts` cover upgrade answer adoption, lost acknowledgements and concurrent reassignment/resolution against PostgreSQL.

Reassignment publishes a new question for the assigned owner and acknowledges the old question as superseded, preserving both reviewed sources. Answers to the old question cannot continue the worker. Reconciliation retries publication and acknowledgement after failure or restart. Existing unowned decisions recover their original publication before publishing a replacement for the assigned owner. Owner labels do not grant runtime approval or delivery authority.

The CLI host also atomically publishes `fleet/health.json`, using Board's versioned `FleetHealth` schema from `@shivaedev/work-board/diagnostics/health.ts`. Running counts work with submitting, accepted or running attempts; queued counts prepared work; waiting counts group every wait by maintainer, orchestrator and automation, including capacity and quota blockers and pending checks. The snapshot uses version 2. The snapshot carries the configured concurrency cap, publication time and freshness threshold, last completed scheduler pass and last observed structured provider capacity rejection. A host restart reloads the two last observations. Status-board and health publication failures do not change execution outcomes; the next publication retries. The daemon retains the same health observation in memory and serves it through the shared `daemon.diagnostics` HTTP RPC query, together with Codex and GitHub rate-limit observations cached for one minute. Board's Diagnostics view reads this RPC query without Fleet or database dependencies; it does not read the health file. Health observations retain their publication time so a stalled runtime remains visibly stale. `src/host/boardDiagnostics.spec.ts` covers Board-to-daemon HTTP reads against PostgreSQL after the health file is removed.

A composed runtime enables health publication with `statusLayer(boardRoot, { concurrency, staleAfterMs })`, provides `healthLayer(boardRoot)` from `@shivaedev/work-fleet/host/healthLayer.ts`, and wraps its provider with `providerHealth` from `@shivaedev/work-fleet/host/providerHealth.ts`. Capacity comes only from structured `rateLimitExceeded`, `flexUnavailable` or `serverOverloaded` errors; unclassified rejection text is not treated as capacity. A repeatedly observed terminal turn does not refresh the same rejection's timestamp.

### Release waiting work

A guided release answer frees terminal Fleet ownership even when the task content or location changed, or the task is now done, deferred or unapproved. Fleet still checks the exact decision source, question and response and refuses release while execution is running or uncertain. A stale retry answer closes the old question and publishes one replacement bound to the current Board revision; preparing the newly approved scope remains necessary before execution can resume. Repeated resolution and restart recover publication and acknowledgement without another replacement.

```sh
work-fleet release sample-one sample-two --board ./notes
```

The command records an explicit release response for each current waiting decision, including worker questions, then uses the same resolution path as a release answer. It supersedes an existing unambiguous response, refuses changed decision sources or competing responses, and can be repeated to recover a pending acknowledgement. `src/engine/staleDecisions.spec.ts` and `src/host/bulkRelease.spec.ts` prove changed-task release, one replacement on concurrent retry, Board Inbox closure and bulk release of done and deferred tasks against PostgreSQL.

### Continue a worker with new instructions

Use `work-fleet continue <id> <message>` to send instructions to the existing worker thread of terminal work waiting on an owner or completed work. Omit the message argument to read it from stdin. The current Board revision still needs approval; running or released work is refused. Work waiting on a human merge can continue on the same worker thread; its reviewed head stays in history and its PR ownership remains until the new result is adopted.

```sh
work-fleet continue work-id "Fix the failed checks on the existing PR" --board .work
printf '%s\n' "Check the remaining criterion" | work-fleet continue work-id --board .work
work-fleet wait work-id --board .work
```

The command persists the message and thread identity before submission and returns the item to Active. Keep `work-fleet serve` observing the Board: `wait` only reads PostgreSQL. A lost acknowledgement retains the attempt for reconciliation without replay. The prior cycle remains in history, including its decision and result; reconciliation supersedes the prior open decision. The new turn's output follows the first-launch adoption path, including report publication or PR review, validation and delivery, and replaces the prior current result. `Fleet.continue(workId, message)` and the native `Continue` command expose the same path to composed hosts.

A failed worker or repair attempt without a receipt is never adopted. Review refresh ignores that attempt and uses the preceding worker receipt for the retained result, including a prior cycle with the same Board revision and result identity. Retrying the failed follow-up starts a fresh independent review before validation and delivery. `src/engine/failedFollowup.spec.ts` covers a completed repair, rejected receiptless follow-up, restart, retry, fresh review and observed delivery against real PostgreSQL with a synthetic provider.

When Codex rejects a turn with `turn already active for thread`, Fleet polls the thread until its active turn finishes, then submits the same saved operation, prompt and settings. Polling starts immediately, with delays doubling from two seconds to a maximum of thirty seconds. The attempt stays submitting with its execution ownership while waiting. The wait has a five-minute deadline across busy rejections and permits at most three resubmissions; reaching either bound follows the definite-rejection path, marks the receiptless attempt failed, requests an orchestrator decision and releases execution capacity. `src/engine/activeTurn.spec.ts` covers waiting across paginated turn observations, continuation and delivery; `src/engine/activeTurnDeadline.spec.ts` covers backoff, a hung active turn reaching the deadline, the durable decision and capacity release after restart. Both use real PostgreSQL with a synthetic provider. `src/providers/activeTurn.spec.ts` covers the resubmission cap through the Codex wire protocol.

### Answer a worker question

Cloud worker prompts instruct workers to stop for a decision with `FLEET_QUESTION: <question>` and include the context and choices needed to answer. Fleet recognizes this marker in a completed worker or repair turn, publishes the question through Board's response writer, and keeps the work in `needs-human`, waiting on the orchestrator by default. Only `FLEET_MAINTAINER_QUESTION: <question>` escalates a worker question to the maintainer; mentioning the maintainer in ordinary question text does not escalate it. `work-fleet wait <id>` exits with code 2 while that question is open. Questions must use one of these explicit markers; Fleet does not infer questions from prose.

Record a nonempty answer through Board's response page or response API. Reconciliation continues the exact worker thread with the answer body under current approval, quota and capacity policy. The response receipt and continuation intent commit together before submission. Concurrent resolution, repeated resolution and restart do not submit the answer again; a lost acknowledgement reconciles the stored operation. If a crash occurs before submission and no authoritative receipt is available, Fleet retains the uncertain operation for human inspection. Clarification, deferral, changed context and competing answers keep the work blocked. Answer text supplies task input and does not grant delivery authority. `src/engine/workerQuestion.spec.ts`, `src/engine/workerContinuation.spec.ts` and `src/host/workerQuestion.spec.ts` cover these rules with a synthetic provider and real PostgreSQL.

### Return a research report

Declare `fleet-deliverable: report` on an approved task to request research. Report workers leave repository sources unchanged and return the whole report in the final message. They may create new uncommitted report attachments, but must never commit, push, create branches or open PRs. Omit the field to keep the PR workflow.

```markdown
---
id: research.example
kind: task
fleet: approved
fleet-deliverable: report
---
# Compare the available approaches
```

After a completed worker turn, Fleet publishes an ordinary `kind: result` item under `responses/fleet-report.<digest>.md`, with an `informs` relationship to the task. The result preserves the whole final output and records the exact session, turn and task revision in its worker receipt. The Markdown gateway uses Board's durable publisher; custom gateways implement `BoardGateway.report` with the same immutable, idempotent boundary. Before writing attachments or publishing, the CLI host saves the complete report text, retrieval warnings and attachment bytes in an immutable payload under `.fleet-reports/`, outside Board’s source index. Publication retries read that payload without recollecting files, preserving the same identity and bytes after restart or a lost acknowledgement even when Cloud retrieval changes. `src/host/reportBoard.test.ts`, `src/board/reportPayloadFile.test.ts` and `src/engine/reportRecovery.spec.ts` cover these boundaries, including concurrent payload writes, symlink refusal and completion after restart against PostgreSQL.

The CLI host reconstructs report attachments from the completed turn’s paginated `thread/items/list` file changes. Workers must create every attachment with the file-edit/apply_patch tool under `/tmp/fleet-report/attachments/`, and use that tool for later edits. Adds contain UTF-8 file content; update hunks and deletes replay in item order to obtain each file’s final bytes. Files created or changed through shell commands are not exposed as file changes. Binary evidence must be attached as a base64 text file with its encoding stated. List every promised file on a separate final-report line, `FLEET_ATTACHMENT: <relative-path>`, so Fleet can record missing files. Files from other directories and earlier turns are excluded. `src/providers/codexReportAttachments.test.ts` covers authenticated pagination across 193 synthetic items; `src/host/reportFileChanges.test.ts` covers ordered replay, moves, deletes and missing files.

Retrieved files are saved in `responses/fleet-report.<digest>.attachments/` beside the result, with links in the report. Markdown attachments receive a `.attachment` suffix so Board does not index them as authored items. Reconstruction uses only new regular scratch files, with normalized relative paths, `lstat`, resolved-path containment and no-follow opens. Turn item downloads are limited to 16 MiB of cumulative UTF-8 JSON, attachment changes to 8 MiB, attachment count to 64 and aggregate attachment bytes to 32 MiB. Unsafe paths, missing adds, mismatched update hunks, unavailable retrieval and collection-limit failures publish report text with an Unavailable attachments section; they do not create a decision. Other retrievable files survive per-file reconstruction failures. Existing saved attachment bytes are never replaced. `src/host/reportAttachmentSafety.spec.ts` proves publication and recorded failures against PostgreSQL and a synthetic Codex WebSocket server. `src/host/reportAttachmentFiles.test.ts` and `src/board/reportFiles.test.ts` cover regular-file safety and immutable attachment storage.

After a terminal report turn, the host checks the configured GitHub remote for the exact `<branchPrefix><workId>` ref and all PRs opened from that branch, including closed PRs. A published branch or PR makes the work wait on the orchestrator with the reason `Report worker published to GitHub`; Fleet never deletes the branch. Unavailable remote evidence also blocks completion. The host rechecks before result publication on retry. Custom headless runtimes provide their report inspection and collection boundaries; the Markdown gateway alone publishes report text.

Successful publication records the report in the current Board read pass and completes the Fleet attempt without PR adoption, independent review, checks or delivery. Empty or whitespace-only output, or a complete report document over Board’s 256 KiB UTF-8 context limit, creates an orchestrator decision with a concrete reason instead of a result. The size check includes metadata, the worker receipt and attachment links, and runs before writing attachment files. Oversized reports leave no attachment folder. `src/host/attachmentSize.spec.ts` covers rejection before attachment writes, including a report that fits the limit until attachment links are added. `wait` and the status views expose the same terminal states and result path. A retry after a publication failure republishes the existing completed attempt; a retry after empty output prepares another worker attempt. Oversized output waits on the orchestrator until its decision is resolved; scheduler passes do not repeat publication. `src/board/publishReport.test.ts` and `src/host/reportSize.spec.ts` cover the size boundary, immediate visibility and durable orchestrator decision. These prompts direct worker behavior; runtime policy still owns execution authority.

### Cloud provider

The hosted Codex transport sends the configured environment and launch fields, then reads the final answer from a terminal turn. It authenticates from a Codex login file and can run a configured refresh command for an expired login. Failed refresh remains unavailable. These boundaries are tested with a synthetic WebSocket backend in `src/providers/codexCloud.test.ts`.

Cloud host configuration accepts `cloud.threadNamePrefix` (default `Fleet: `), `cloud.projectId` for an existing project, and `cloud.archiveThreads` (default `true`). Names use `<prefix><work-id>: <title>` from the prepared Board context's first heading. Titles have normalized whitespace and at most 80 Unicode characters, with an ellipsis when trimmed; a missing heading falls back to the work ID. Separate reviewer and repair threads add `(review)` or `(repair)` after the work ID. A repair that continues the worker thread retains its name. The Fleet session journal resolves names from persisted operation intents, so review integrations that start through the same session service receive reviewer names automatically.

Fleet persists the session acknowledgement before naming it. Launch naming retains the acknowledged work ID and loads only that record; `src/engine/sessionNaming.spec.ts` proves one lookup with both one and 1,000 stored records, and rejection of missing or ambiguous intents without scanning other records. Naming is best-effort: a rejected or failed request logs a warning with the session ID and cause, then Fleet starts the turn. Project assignment is sent with `thread/start`. `work-fleet name-threads` reads all stored Fleet records, including archived cycles and acknowledged sessions without turns, and renames threads whose current names differ from their Fleet names. It reports each rename to stdout and each read or rename failure to stderr, then continues other sessions. Shared threads are visited once and retain their original role and context. Repeating the command skips successful names and retries failures. `src/engine/threadNames.test.ts`, `src/providers/cloudMetadataFlow.spec.ts` and `src/host/cloudThreadNamesFlow.spec.ts` cover formatting, startup ordering, best-effort failures and backfill idempotence with real PostgreSQL and a synthetic Cloud backend.

Restart the host with the same SQL namespace. An attempt intent commits before `thread/start`, its session acknowledgement commits before `turn/start`, and its turn acknowledgement commits before observation. SIGKILL tests against real PostgreSQL and a synthetic Cloud server cover both sides of these mutations and recovery of 100 concurrent attempts with lost turn acknowledgements. These tests prove host persistence and Cloud adapter wire behavior; they do not prove live hosted execution.

If the session ID is known, reconciliation searches all provider turn pages for the persisted operation ID and adopts the exact existing receipt. For an acknowledged Cloud thread with no turns, Fleet polls for up to five seconds to allow late acceptance to appear. If the thread remains empty, Fleet confirms its environment and starts the saved turn on that same thread, retaining the attempt and operation ID. Retry on a missing-turn decision uses the same recovery, including prepared prompts from older worker records. Recovery requires the current Board revision to remain approved. Missing or incomplete thread evidence, unrelated turns and duplicate operation matches stay blocked. If the thread acknowledgement itself was lost, the current protocol cannot locate that thread by operation ID: Fleet retains the attempt and reservation and raises a human blocker. Recovery never starts another thread for that attempt. `src/host/cloudRestart.spec.ts` proves empty-thread recovery, late acceptance and guided retry after SIGKILL against real PostgreSQL and a synthetic Cloud server; `src/providers/recoverTurn.test.ts` covers the grace period and uncertain evidence. Provider unavailability after session acknowledgement and a mismatched setting after thread creation also retain unresolved ownership.

Fleet cleans up worker, repair and reviewer threads after accepted completion or explicit safe release, and after renewal makes a prior conversation unusable for further repair. Terminal provider turns alone do not trigger cleanup: review, checks and human retry can still require the conversation. Cleanup deduplicates shared repair threads, includes acknowledged sessions without a turn, and persists completion markers. Archive failures leave the Fleet outcome accepted; scheduler reconciliation retries pending cleanup, including after restart or renewal, without repeating delivery. `cloud.archiveThreads: false` retains sessions and settles cleanup for that cycle. Transports without an archive capability also retain their sessions.

The adapter sends `thread/archive` and `thread/name/set`; grouping uses `thread/start.projectId`. The generated experimental app-server protocol also declares `thread/metadata/update.projectId` and `thread/list.projectId`, but Fleet does not call those methods. PostgreSQL regressions prove the cleanup lifecycle, and a synthetic WebSocket backend verifies the host configuration and wire requests. These fixtures do not prove hosted acceptance or removal from the ChatGPT and Codex sidebars.

Cloud worker instructions include startup waiting, the configured environment script, fetching current main to start the branch, repository checks and one pull request for human review. Workers watch CI after every push, repair failures on the same branch and report once CI is green on their exact head. The merge queue re-runs CI against latest main before merging. Workers merge main only when GitHub reports a conflict or their change needs something that landed there; a conflict-free branch behind main does not require a merge, fresh review or revalidation. Workers state the exact head's CI result before the final `FLEET_PR: <url>` or `FLEET_PR: none` line. The parser requires exactly one marker on the final line; missing or malformed reports yield no result. `src/prompt/worker.test.ts` and `src/prompt/reviewer.test.ts` cover these instructions and the parser. A report line is not proof of an adopted result or accepted delivery.

### Adopt a worker result

Select `"result": "github"` in the host's `fleet.config.json` to adopt a completed worker report through the authenticated `gh` CLI. The final two report lines are one `FLEET_HEAD: <sha>` line with the full head SHA and one `FLEET_PR: https://github.com/<owner>/<repo>/pull/<number>` line. Both markers tolerate surrounding whitespace and backticks around their values. Adoption records the GitHub PR number, exact head and all paginated changed paths, including both paths of a rename. The PR must be open or merged in the host repository and target its configured branch; a different reported head or base/path movement during observation fails with a typed `FleetFailure`. A PR closed without merging waits on the orchestrator.

A PR merged before adoption or during review still requires independent approval and checks for its reported head before Fleet accepts the observed merge as delivery. Retrying a failed adoption resumes the completed worker receipt; retrying after review reuses that review session. `src/engine/mergedAdoption.spec.ts`, `src/engine/mergedReview.spec.ts` and `src/engine/mergedReviewRecovery.spec.ts` cover these transitions against real PostgreSQL and a synthetic HTTP GitHub server.

A final `FLEET_PR: none` claims no change at the reported `FLEET_HEAD`. Fleet retains that head and the report as evidence, and passes the result through independent review and required checks. Main movement does not invalidate the report; a changed task revision prevents adoption. Fixture tests exercise GitHub responses and the PostgreSQL adoption path, not live GitHub or worker execution.

When GitHub adoption rejects a completed worker or repair report's format, Fleet requests one corrected report on the same worker thread, with the exact required ending. A second malformed report needs a human; answering `retry` starts a new correction turn. Valid reports rejected for GitHub identity, head or state still need a human decision. Correction attempts retain launch settings, persist before submission and reconcile lost acknowledgements after restart. `src/engine/reportCorrection.spec.ts` and `src/engine/workerReportRecovery.spec.ts` cover these paths with real PostgreSQL and a synthetic provider.

`src/host/githubResult.test.ts`, `src/host/githubResultFailures.spec.ts` and `src/engine/resultAdoption.spec.ts` cover these adoption boundaries.

### Independent review

After adopting a result, Fleet starts an independent reviewer through the same `SessionService`, provider and durable journal as workers. Reviewers receive the Board task and criteria plus the adopted result at its exact head, without the worker conversation or preparation prompt. They use `FleetPolicy.launch` from host configuration; task launch overrides remain worker and repair settings. `FleetPolicy.reviewerGuidance` supplies repository-specific validation instructions, resolved by the command host from `worker.reviewerGuidance`. The Codex adapters request read-only execution with shell network access for read-only PR and exact-head CI inspection, and no escalation. Reviewers use existing exact-head repository objects, read-only repository tools or `gh pr view`, `gh pr diff` and `gh api --method GET`; network writes are prohibited. When the exact-head diff and check results are readable, the prompt requires a verdict. Passing required checks at that head are CI evidence even when job logs or artifacts are unavailable; reviewers record that limitation in their evidence.

The reviewer ends with `FLEET_REVIEW:` followed by JSON containing `head`, `verdict` (`approve` or `changes`), nonempty `evidence` and `findings`. Changes require concrete findings; approval requires an empty findings array. Fleet accepts this verdict only after the exact turn completes and records it with that revision and receipt. Accepted or running turns keep their execution slot without a verdict. A lost acknowledgement reconciles the existing operation. Failed turns produce a decision waiting on the orchestrator. A malformed completed verdict gets one automatic follow-up on the same read-only reviewer thread requesting the required format. Fleet persists that attempt before submission and reconciles its receipt after restart; a second malformed reply produces a decision waiting on the orchestrator. When delivery observation finds a moved PR head after approval, Fleet verifies the current PR and its reserved paths, retains the prior result and review, clears stale checks and automatically starts a fresh independent reviewer before checks or delivery. The new result and review stage are persisted before reviewer launch so reconciliation can resume after restart. Retrying a stored moved-head decision observes the current PR and starts that review without re-parsing the old worker report.

`src/engine/reviewerSession.spec.ts`, `src/engine/reviewerEvidence.spec.ts`, `src/engine/recovery.spec.ts`, `src/prompt/reviewer.test.ts` and `src/providers/readOnly.spec.ts` cover these boundaries with real PostgreSQL and synthetic providers; they do not prove live Cloud review.

### Required checks

The command host reads GitHub check runs and commit statuses through an authenticated `gh` CLI for the adopted PR's exact commit SHA, including all pages. Pending or absent checks keep work in validation; failed checks send their names and links to the repair worker. A newer push does not replace the adopted head's evidence. Every observed check must succeed, be neutral or be skipped; this does not establish branch protection or merge authority. `src/host/githubChecks.test.ts` and `src/engine/validation.spec.ts` cover these rules with synthetic GitHub responses and real PostgreSQL.

For built capabilities and open host integrations, see the [roadmap](https://github.com/ShivaeDev/platform/blob/main/packages/work-fleet/docs/roadmap.md).

### Human delivery

Fleet never submits a merge. Reviewed, green PRs wait on the maintainer as ready to merge. Reconciliation keeps observing the adopted PR through `gh pr view` with the host's existing CLI authentication, accepts only a merge of the reviewed head and records the PR head and merge commit. A PR closed without merging waits on the orchestrator with that fact. A head moved after approval goes through fresh independent review and checks automatically. A temporary observation failure preserves the current Board decision and ownership until GitHub evidence is available again. `src/host/githubDelivery.test.ts`, `src/engine/humanDelivery.spec.ts`, `src/engine/deliveryObservation.spec.ts`, `src/engine/movedHeadDelivery.spec.ts` and `src/engine/movedHeadRecovery.spec.ts` cover these rules with synthetic GitHub responses and real PostgreSQL.

Main advancing alone does not invalidate adoption, review or validation of an unchanged PR head. `src/host/githubResult.test.ts` covers adoption while the base SHA moves without changes to the reported head or paths. `src/engine/behindMain.spec.ts` uses synthetic GitHub responses and real PostgreSQL to prove an approved, green, conflict-free head behind main stays ready through reconciliation and restart, then accepts its human merge without repeating review or validation.

## Compose the Effect core

Each scheduler pass shares one Board read and identity index across admission, dispatch and reconciliation. The next pass reads changed, added and removed files again. Work revisions follow the authored brief read; approval is read separately, and decision publications retain their exact source revisions. Fleet's own publications enter the current snapshot after they are recorded; reconciliation that outlives the pass reads fresh sources.

Fleet excludes files with invalid metadata or unreadable sources from admission, records a Board problem with the file and diagnostic, and retries them on the next pass. An unrelated invalid file leaves running work executing. A lookup of an invalid or missing work source still blocks that work; when metadata cannot supply its identity, the missing-identity diagnostic includes the Board file problems. The named problem reaches the execution status and the published decision, using the original approved context for publication. `src/host/boardReadErrors.spec.ts` proves admission, recovery, running-work isolation and named diagnostics against real PostgreSQL.

Provide `BoardGateway`, `FleetRepository`, `FleetPolicy`, `FleetIntegrations` and `SessionService` to `Fleet.layer`. The Markdown gateway reads Board context, and `postgresFleetRepository(namespace?)` supplies durable SQL attachments on a native `SqlClient`. A session journal persists intents and acknowledged turns before further remote mutation. `src/session/service.test.ts` and `src/engine/recovery.spec.ts` cover receipt ordering and recovery without duplicate launch.

```ts
import { Fleet } from "@shivaedev/work-fleet/fleet.ts";
import { cycle } from "@shivaedev/work-fleet/engine/scheduler.ts";

const fleet = yield* Fleet;
yield* fleet.prepare({ workId, preparation, prompt, cwd });
yield* cycle;
```

Run this Effect program with your composed Fleet Layer. `FleetIntegrations` supplies source observations, actual result adoption, required checks and delivery observation. Its `result` implementation must re-read current result ownership and head each time it is called. Review and checks must name the exact adopted head; the reviewer must use a different session from the worker. `src/engine/completion.spec.ts` tests those requirements, repair and validated no-change with real PostgreSQL and synthetic integrations.

Dependencies require accepted outcomes for their current authored brief revisions. Criterion-specific references remain blocked. `src/engine/dependencies.spec.ts` and `dependencyBookkeeping.spec.ts` cover those boundaries. The core's native RPC commands and derived views are covered by `src/engine/rpc.spec.ts` and `src/engine/activeViews.spec.ts`. These library tests do not prove live provider execution or delivery.
