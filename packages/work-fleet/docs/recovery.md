# Execution protocol and recovery

This page describes how Work Fleet keeps provider work durable: what it saves before each remote call, how it retries, and how it recovers a turn it cannot see. The [README](../README.md) explains the model and daily use; read it first. Everything here follows one rule: Fleet never loses an execution and never starts a duplicate, so when it cannot tell what happened, it keeps ownership and reconciles the existing operation.

## Save before every remote call

A session journal persists intents and acknowledged turns before further remote mutation, so recovery never launches a duplicate. An attempt intent commits before `thread/start`, its session acknowledgement commits before `turn/start`, and its turn acknowledgement commits before observation. Restart the host with the same SQL namespace to recover that state.

Restart recovery reuses saved launch intents and acknowledged threads. Retry or release fences late acknowledgements and retires an intent without a persisted thread acknowledgement before a turn can start.

Closing the daemon scope stops scheduling and HTTP, then closes the provider services and pool. A migration failure prevents provider acquisition and scheduling.

## Launch and acknowledgement

Scheduler dispatch submits queued items in sequence and stops the pass after a transient provider rejection. Worker and repair launches wait up to one second for acknowledgement after persisting their intent; missing replies retain execution ownership while the pass continues dispatching. The provider request continues in the service scope so late replies are persisted, and reconciliation waits for that request to finish before recovering the operation. Explicit caller interruption still cancels the submission.

Rejected credentials and refused policy require a human decision. Ambiguous submissions retain their existing ownership for reconciliation. A retry after an explicitly rejected first turn reuses the acknowledged thread.

## Provider capacity

Rejected work releases execution capacity and retries on later passes with durable delays of 30, 60, 120 and 240 seconds. Queue-full, structured provider capacity failures and the explicit “Selected model is at capacity” rejection receive at most five attempts. Failed worker and reviewer turns with those capacity failures use the same retry budget. When it runs out, Fleet parks the item with the provider failure and the number of attempts.

The waiting item is tried before the rest of the queued backlog, so provider capacity backoff also pauses that backlog. `work-fleet status` shows waiting for provider capacity with the last rejection time and next retry time.

Codex RPC overload code `-32001` produces a `SessionFailure` with code `session-queue-full`; launch backoff uses that code and the rejected failure kind. Quota admission produces a platform `Forbidden` with `provider-quota-unavailable` in its failure context, which reconciliation keeps waiting on automation. Rewording either failure message leaves its retry or waiting behavior unchanged. Custom integrations supply these codes for the same behavior.

## Read retries

A capacity rejection while reading or reconciling a turn does not establish that its submission failed. Fleet backs off those reads on the existing operation, retaining the attempt, receipt and execution reservation across restart.

Reads use a separate five-attempt budget with delays of 30, 60, 120 and 240 seconds; a successful observation clears that wait. `readRetryMs` in Fleet policy or `fleet.config.json` sets the first delay, defaulting to `30000`, and each later delay doubles it; integration evidence reads use the same schedule. Exhaustion parks with the provider read failure and attempt count while retaining execution ownership. A human retry reconciles that operation; it does not launch a replacement.

## Generic protocol rejections

Codex protocol rejections with no specific cause retry the same method and parameters, including the saved operation ID and thread, after 30 and 60 seconds. A third rejection reaches the ordinary failure handling and publishes a decision for a turn submission.

Generic messages are “Something went wrong”, “Internal error”, “Internal server error” or an absent message, with an optional request ID. Invalid request, permission and quota messages do not use these retries or contention replay. Structured capacity failures keep their separate retry budget.

## A turn that is already active

When an otherwise unclassified definite Codex turn rejection has an active turn in the provider's paginated turn state, Fleet classifies it with code `session-active-turn`. The retry rule uses that code, polls until the thread is idle, then submits the same saved operation, prompt and settings. Rewording the rejection leaves this behavior unchanged. An idle thread or unreadable state cannot authorize contention replay; distinct coded failures retain their own handling.

Polling starts immediately, with delays doubling from two seconds to a maximum of thirty seconds. The attempt stays submitting with its execution ownership while waiting. The wait has a five-minute deadline across classification and busy rejections and permits at most three resubmissions.

Reaching the wait deadline retains `session-active-turn`; exhausting resubmissions records `session-active-turn-exhausted`. Both mark the receiptless attempt failed, release execution capacity and queue a fresh thread with the saved instructions on the same branch and PR. The explicit “turn already active for thread” rejection uses that fallback even when the turn state appears idle. Fresh-thread retries share the five-attempt provider budget and persist their backoff across restart; exhaustion parks with the failure and attempt count. Credential and policy rejections cannot authorize contention replay even when the provider has an active turn.

## Stalled turns

`stallMinutes` is a positive integer, defaulting to 30. Fleet follows each running Codex turn's live events and also reads its latest item; a live event, a new item or a changed item status resets its progress timer.

The Codex transport subscribes again on its next observation after a reconnect or host restart, because Codex Cloud shows a running turn's items only once the turn ends. The silence interval starts at the current live subscription or later observed activity, so a restart or reconnect gives an old running turn a full interval.

After one idle interval Fleet asks the orchestrator to keep waiting, retry in a fresh session or abandon the turn. Keeping the same turn restarts the silence interval. New activity or completion automatically closes an unanswered stall decision and continues the turn's result. Fleet never steers or interrupts a silent turn on its own, because a message reaches a working agent as an interruption. Progress times persist across host restart, and CLI status and the generated status page show each turn's last progress time.

## Lost and missing turns

Without a publication integration, a missing acknowledged turn stays under observation for five minutes after its first absence or the latest thread progress. Changed items or statuses on an older or newer running turn extend this grace period. If the turn remains invisible without progress, Fleet resumes its existing thread once. Observing that resumed turn clears the consecutive-loss count; a second consecutive loss asks the orchestrator. The grace timer and retry count persist across restart.

For an initial worker or repair turn, Fleet checks that its thread is idle before replacing it. An active thread retains execution ownership for a five-minute visibility grace period after its latest progress, then needs a decision if it is still active.

Fleet then checks the item’s remote branch and all PR states:
- With neither published, it records the missing-turn evidence, retires that execution and relaunches automatically.
- With a branch or open PR, it starts a repair turn on a fresh thread and instructs it to reuse that branch and PR.
- A merged or closed PR prevents relaunch and needs delivery inspection.
- A confirmed branch or PR is enough even if the other read fails; inconclusive publication reads need a decision. A PR with unknown state needs a decision.

Every lost turn rechecks current thread and publication state, including a lost repair after a completed replacement. Idle threads with conclusive publication evidence recover automatically again. Answers recheck thread and publication state, and reach the replacement turn when safe. A quota wait retains the original lost intent until its replacement is admitted; retirement and the replacement intent save together.

Relaunch prompts contain the original brief and one recovery note; the saved brief stays unchanged. Status and watch show the recovery reason while the replacement turn executes; the notice clears when work advances to review.

Composed hosts provide publication evidence through optional `FleetIntegrations.publication(work)`, returning `WorkPublication` with `branch`, `remoteBranch`, optional `pullRequest` and `pullRequestState` (`open`, `closed` or `merged`).

## Lost reviews

A review with a lost thread acknowledgement or an unobservable submitted turn is safe to repeat because it changes no code. When its provider read budget runs out, or reconciliation reports `session-turn-missing` without a pending read retry, Fleet retires the unacknowledged review and queues a fresh read-only thread for the same head under the shared five-attempt provider retry budget. Late acknowledgements of the retired attempt are rejected. Lost worker and repair threads still retain execution ownership and require a human decision after read exhaustion.

## Codex Cloud thread recovery

If the session ID is known, reconciliation searches all provider turn pages for the persisted operation ID and adopts the exact existing receipt.

For an acknowledged Cloud thread with no turns, Fleet polls for `cloud.recoveryGraceMs` (default five seconds) to allow late acceptance to appear. If the thread remains empty, Fleet confirms its environment and starts the saved turn on that same thread, retaining the attempt and operation ID. Retry on a missing-turn decision uses the same recovery, including prepared prompts from older worker records. Recovery requires the current Board revision to remain approved. Missing or incomplete thread evidence, unrelated turns and duplicate operation matches stay blocked.

If the thread acknowledgement itself was lost, the current protocol cannot locate that thread by operation ID: Fleet retains the attempt and reservation and raises a human blocker. Recovery never starts another thread for that attempt. Provider unavailability after session acknowledgement and a mismatched setting after thread creation also retain unresolved ownership.

## Brief steering

When an approved brief changes while its worker or repair turn has an active receipt, Fleet steers the turn through the provider steer operation with a summary of the changes followed by the full new brief. Each authored revision is attempted at most once per turn, including after restart or a brief reverting to a previously steered revision. The approved brief and steer intent commit together before the provider call.

CLI status records the request time, acknowledged delivery time or failure; interrupted delivery remains unconfirmed and is not replayed. Unsupported or failed steering leaves the updated brief in place for independent review and later repairs on the same worker thread. Completed turns and reviewers receive no brief steer.

## Answers and continuations

Each waiting request tracks its exact published decision and response before resolution. `work-fleet answer` refreshes the managed decision and registers its current question before answering, including after a changed template was republished. If reconciliation replaces a decision with another of the same kind during the command, the answer applies to the current decision. A different kind or a move out of waiting records `Decision changed` with the current reason in status.

When reconciliation continues a worker thread with an answer, the response receipt and continuation intent commit together before submission. Concurrent resolution, repeated resolution and restart do not submit the answer again; a lost acknowledgement reconciles the stored operation. If a crash occurs before submission and no authoritative receipt is available, Fleet retains the uncertain operation for human inspection.

An accepted answer whose turn stays absent for five minutes without thread progress gets one automatic restart in a fresh session, carrying the original brief, answer and instructions to reuse the branch and PR. Fleet records abandonment and attempts to interrupt the missing turn. If the replacement also stays invisible without progress for five minutes, Fleet abandons it, releases execution capacity and areas, and asks the orchestrator to inspect the thread and published work. The timer and recovery count survive restart, including answer attempts retained by an older daemon. When the accepted turn becomes observable, Fleet closes its stale missing-turn decision and follows that turn. A second answer against a missing-turn decision on an active or unreadable thread fails explicitly without submitting another turn.

`work-fleet continue` persists the message and thread identity before submission. A lost acknowledgement retains the attempt for reconciliation without replay.

Repeated resolution and restart recover the same response and acknowledgement. Retrying the original decision ID for the same committed reassignment recovers publication and acknowledgement without creating another question.

## Moved heads and failed follow-ups

When delivery observation finds a moved PR head after approval, Fleet verifies the current PR and its reserved paths, retains the prior result and review, clears stale checks and automatically sends the head through the currently configured review path and fresh checks before delivery. The new result and review stage are persisted before reviewer launch so reconciliation can resume after restart. Retrying a stored moved-head decision observes the current PR and starts that review without re-parsing the old worker report, including when the prior review evidence is missing or stale.

A failed worker or repair attempt without a receipt is never adopted. Review refresh ignores that attempt and uses the preceding worker receipt for the retained result, including a prior cycle with the same Board revision and result identity. Retrying the failed follow-up starts a fresh independent review before validation and delivery.

## Release with uncertain execution

Before a release, Fleet reconciles unresolved receipts without submitting a turn and observes pending attempts; running, unreadable or mismatched execution evidence keeps ownership.

When the provider reports `session-turn-missing`, or confirms the acknowledged turn is absent with no active thread progress, reconciliation releases a waiting item whose Board status is done, deferred or dropped. For an open task, `work-fleet answer --release <id>` releases it. Both paths retire the lost attempt, preserve its recorded receipt and mark its session unusable without replaying or resuming the turn. An uncoded ambiguous failure or unreadable provider evidence cannot authorize release by its wording.

## Thread cleanup

Fleet cleans up worker, repair and reviewer threads after accepted completion or explicit safe release, and after renewal makes a prior conversation unusable for further repair. Terminal provider turns alone do not trigger cleanup: review, checks and human retry can still require the conversation.

Cleanup deduplicates shared repair threads, includes acknowledged sessions without a turn, and persists completion markers. Archive failures leave the Fleet outcome accepted; scheduler reconciliation retries pending cleanup, including after restart or renewal, without repeating delivery. `cloud.archiveThreads: false` retains sessions and settles cleanup for that cycle. Transports without an archive capability also retain their sessions.

The adapter sends `thread/archive` and `thread/name/set`; grouping uses `thread/start.projectId`. The generated experimental app-server protocol also declares `thread/metadata/update.projectId` and `thread/list.projectId`, but Fleet does not call those methods.

## Thread names

Fleet persists the session acknowledgement before naming it. Launch naming retains the acknowledged work ID and loads only that record. Naming is best-effort: a rejected or failed request logs a warning with the session ID and cause, then Fleet starts the turn. Project assignment is sent with `thread/start`.

The Fleet session journal resolves names from persisted operation intents, so review integrations that start through the same session service receive reviewer names automatically.

## Record storage

Fleet stores scalar fields and scalar lists in typed PostgreSQL columns through sql models. Nested objects use typed columns, and repeated records use ordered child tables, including archived cycles. Foreign occupancy uses a separate model repository. Versioned transaction writes reject stale updates and replace child rows atomically; the adapter retains Fleet’s one-based record versions. Engine record reads hold a shared transaction lock while loading their columns and children. Answer receipt and CLI status reads, and the daemon's status flush on shutdown through `Fleet.listSnapshot()`, use a repeatable-read snapshot so admission does not delay them.
