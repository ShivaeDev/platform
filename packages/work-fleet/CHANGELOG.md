# Changelog

## 0.7.0 - 2026-10-18

### Added

- Board lookup failures use the `board-item-missing` error code and optional `BoardFailure.workId` to distinguish confirmed absence from unreadable or ambiguous Board sources.

### Changed

- Published Fleet decisions now state in plain words what happened, what Fleet needs and recommends, and what each option does. Option labels fit the situation, such as "Continue on the updated task" for an edited brief and "Request changes" next to a note that merging happens on the PR for merge-ready work. Option ids `retry` and `release` and the answer protocol are unchanged.

### Fixed

- Release foreign reservations when the existing delivery observation confirms their PR closed without merging, freeing open-PR backlog for waiting work. Repeated idle reconciliation emits no redundant reservation commit notifications. Releasing the closure decision keeps the reservation absent without another GitHub read. Closed delivery decisions use the `pr-closed` code.
- Prepared work whose Board item was deleted is released and logged instead of blocking its area queue, including after restart. Scheduler dispatch failures refresh saved blocker text and are logged, so status no longer shows an obsolete area holder.
- Merge-ready PRs and changed Board briefs ask the orchestrator for a decision. Superseded Fleet decision publications close on the Board, including older publications found during upgrade. Explicit maintainer reassignments survive the routing upgrade.
- Fleet records completion of the one-time decision cleanup in `.fleet-decision-closure-v1.json` in the Board root.

## 0.6.0 - 2026-10-18

### Added

- Export `holdsAreas(record, now, mergeWaitMs)` from `scheduling/areas.ts` to share Fleet's area ownership predicate.

### Fixed

- A retry answer on a Board context changed decision now records a single applied receipt instead of also queueing a superseded one, and Fleet refuses to write a second receipt for a question that already has one.
- Work with unmet dependencies no longer blocks ready work in the same area, including when an existing waiter becomes blocked. Eligible waiters retain their queue order. Area queue checks read only earlier waiters, so an unreadable later item cannot block ready work ahead of it.
- Repairs and continuations of current area holders skip waiter eligibility reads, so an unreadable earlier waiter cannot prevent them from continuing. Work that must reacquire an area still checks earlier waiters and storage ownership.

### Breaking

- Remove `FleetRecord.admissionReady` and `FleetCycleSnapshot.admissionReady`; the database migration drops their current and archived columns. `LaunchAdmission.areaWaiters` and `AdmissionLimits.scheduling.waiters` are now required lists of eligible work IDs.

## 0.5.0 - 2026-10-18

### Breaking

- Remove `runFleet`, `continueWork` and `dispatchWork` from `host/commands.ts`, and remove `host/reassignWork.ts` and its `reassignWork` export. Run the host with `serveFleet` from `host/daemon.ts`.
- Remove the `renderStatus` pass-through from `host/status.ts`; import it directly from `host/renderStatus.ts`. Import `fleetStatus` from `host/fleetStatus.ts` after the module rename.

## 0.4.0 - 2026-10-18

### Added

- `readRetryMs` in Fleet policy and `fleet.config.json` sets the first provider and integration read-retry delay, defaulting to 30 seconds; later retries still double it. The daemon applies an edited value without a restart.

### Fixed

- Conflict repairs on existing PRs keep or regain their area ahead of prepared items with terminal provider attempts.

### Breaking

- `readHostConfig` and `loadHost` moved from `@shivaedev/work-fleet/host/config.ts` to `@shivaedev/work-fleet/host/configFile.ts`.

## 0.3.0 - 2026-10-17

### Added

- `cloud.recoveryGraceMs` in the host configuration sets how long Fleet polls an acknowledged, empty Cloud thread for a late-accepted turn before it starts the saved turn on that thread. The default stays five seconds.
- The Fleet daemon watches its config file and applies valid edits to `concurrency`, `backlog`, `intervalSeconds`, `quota`, `launch`, `openPullRequests`, `stallMinutes`, `areaMergeWaitMs` and worker or reviewer guidance on the next scheduler pass or launch, without a restart. Running turns keep their launch settings.
- Edits to restart-only settings such as `provider`, `database`, `namespace` or `cloud` keep their running values and are reported as needing a restart. An invalid or partly written file keeps the last good config and logs a `HostConfigRejected` warning naming the failing field.
- `work-fleet status` shows the config the daemon applies, when it was loaded, the settings waiting for a restart and the last rejected edit; `daemon.status` returns it as `config`.
- `openPullRequests: { ease, max, floor? }` in `fleet.config.json` slows new implementer launches as Fleet-owned open PRs pile up: full `concurrency` up to `ease` open PRs, then linearly fewer down to `floor` (default 0) at `max`. Held items wait with `waiting for open PRs to merge: <open> of <max>`. Reviews, repairs and answers are never throttled, and when slots are short they go ahead of new implementers.
- `work-fleet dispatch --now <id>`, or `fleet-priority: urgent` in a task's frontmatter, launches the item over `concurrency`, the open-PR curve and `backlog` while still respecting area claims and dependencies; `--ignore-areas` also skips area claims. `work-fleet status` marks such launches as `launched over the limit`.
- `fleet-priority: urgent | high | normal` in task frontmatter orders prepared work for admission when slots are short.
- `Fleet.recordResponse(workId, decisionId, responseId)` validates a saved Board response, marks it durably and applies it in the Fleet service's background scope. Reconciliation can recover the saved response after a restart.
- `ANSWER_RECORDED` in `attention.ts` identifies pending answer application. `answerWork` accepts an optional background flag, and `daemonRequest` accepts a request name and timeout in milliseconds.
- `DispatchRequest` receipts record acceptance and completion or failure independently of preparation. `dispatchStore(namespace)` persists the latest receipt per item; `dispatchRequests(host)` runs pending requests in the daemon scope and resumes them after a restart. `daemon.dispatch-status` reads the receipt, and `FleetViews.dispatches` exposes pending and failed requests to status.

### Fixed

- The daemon records and applies an answer or release even when the CLI stops waiting for it. Before, a client timeout interrupted the request and the answer was lost.
- Daemon answers and releases share one watched Board response index instead of reindexing the whole Board for every request.
- `work-fleet answer --release` without text no longer waits for stdin.
- Scheduler passes no longer rewrite prepared work whose wait reason is unchanged, and Fleet record lists reuse decoded records that have not changed. A pass over many waiting items stays cheap enough for the daemon to keep answering requests.
- Fleet store failures from `daemon.fleetItems` reach HTTP RPC clients as the diagnostics contract's typed `ServiceUnavailable` rejection instead of a defect.
- Fleet no longer exhausts the GitHub budget. PR state, checks, rulesets, PR files and report publication are read through GitHub's REST API with conditional requests, so an unchanged resource answers `304 Not Modified` and costs no rate limit. Delivery polling no longer uses GraphQL.
- The scheduler runs at the configured interval while the recorded REST `core` budget is above half and slows down between half and 20%. Below 20% remaining Fleet makes no call to that resource until its reset, keeping the rest of the shared token for agents and people, and affected work shows `GitHub paused below the 20% reserve until <time>`.
- A rate-limited GitHub response stops further calls to that resource until its reset, `retry-after` time or backoff. Affected work shows `GitHub is rate-limited until <time>` and does not escalate as a read failure.
- `fleet/health.json` and the daemon's diagnostics carry the rate-limit headers of Fleet's own GitHub responses per resource with their observation time. Release together with `@shivaedev/work-board`, whose diagnostics schema changes with it.
- Cloud dispatch flags a criterion as local-only only when it names the local Board directory as a whole path segment. A criterion that names a longer path starting with the same letters, such as a `.worktrees` folder next to a `.work` Board, now launches.
- Daemon answer and dispatch commands acknowledge durable recording before provider work completes. Reconciliation applies saved answers after a restart, and watch reports the outcome.
- Background dispatch preserves explicit approval and the current launch prompt, including when an edited criterion unblocks work before its first attempt.
- Dispatch records acceptance before refreshing remote main or preparing execution. Status and watch report pending dispatches and background refresh failures even before an execution record exists.
- Watch preserves the current execution and terminal outcome after scheduler recovery from a failed dispatch without another dispatch. The failed receipt remains available through `daemon.dispatch-status`.
- CLI request errors distinguish refused connections from timeouts and server failures, name answer and dispatch requests, and say when answer recording is unconfirmed.
- A broken Fleet database now reports unavailable instead of an empty status when the records or dispatches table is missing.

### Breaking

- `answerWork` and `releaseItems` require the Board `Responses` service. Provide it with `decisionResponses(host)` or `withDecisionResponses(host, effect)`.
- `ClientContract`'s `daemon.dispatch` returns a `DispatchRequest` receipt instead of a prepared `FleetRecord`.
- Remove `makePostgresFleetStore(...).initialize()`, the `storage/migrateFleet.ts` export and the `legacyOnly` argument to `fleetMigrations`. Migrate through `appDatabase` with the `fleetMigrations(namespace)` loader before using the store.
- Remove the unused `recordPayloads` export from `@shivaedev/work-fleet/host/recordPayloads.ts`.

## 0.2.1 - 2026-10-17

### Fixed

- Uses Platform 0.14.1 and Work Board 0.14.2 to keep published dependencies aligned with the exported trace URL redaction security fix.

## 0.2.0 - 2026-10-17

### Added

- Export `briefEditPrompt(previous, current)` for correction prompts, `briefSteerIntent(previous, record, requestedAt)` for durable intent preparation, and `steerBrief(state, stored, previous)` for delivery through the existing session service.

### Fixed

- Steer approved brief edits into an active worker or repair turn with a change summary and the full new brief. Persist each revision's steer attempt before delivery so reconciliation and restarts do not repeat it; failed steering retains the new criteria for review.
- Show brief steer requests, acknowledged delivery times and failures in Fleet status. Attempt records and session views expose optional `briefSteers` entries with `revision`, `requestedAt`, optional `steeredAt` and optional `error` fields.
- Cloud worker and reviewer startup instructions use login-shell environment activation, with a single fallback when Node does not match `.node-version`. Code workers run `./script/update` immediately after fetching and creating their branch; report workers run it before executing repository commands.
- Align published SQL, Platform, contract and Work Board dependencies with the current framework releases.
- Fresh worker retries refresh their preparation from current main before host dispatch, preserving prior attempts and response receipts without asking a human to resolve stale preparation.
- Stalled turns retain their recovery state when a brief edit replaces the current decision. Retry or dispatch of the revised brief abandons the stalled turn and starts a fresh session; late output and acknowledgements remain fenced out. Release can also abandon the stalled turn after a decision replacement.
- Retry and release can abandon a stalled provider turn even when it still reports running or no longer responds. Retry starts a fresh session, and abandoned turns cannot supply accepted output or late acknowledgements. Attempts retain the provider's last observation and interruption or observation failures in an optional `abandoned` field.

## 0.1.1 - 2026-10-16

### Fixed

- Validate only the newest run of each GitHub check name on the adopted head, using completion time or start time. Superseded cancelled or failed runs no longer trigger repairs.
- Revalidate check repairs that leave the PR head unchanged without repeating the approved review. Three completed repairs of the same failing checks exhaust the repair limit even when a repair submission failed between them.

## 0.1.0 - 2026-10-16

### Added

- `work-fleet answer <work-id> [text]` records an orchestrator response to the waiting worker question or Fleet decision. Text can come from stdin. Worker answers continue the same thread; retry text on a reviewed, ready PR requests changes on the same branch and PR. `--release` releases terminal ownership.
- `daemon.answer({ workId, text?, release? })`, `answerCommand` in `host/actionCommands.ts`, and the `answerWork` host helper expose the answer path. `Fleet.publishDecision(workId)` refreshes its durable question registration before resolution.
- Schedule exact Board `areas` under PostgreSQL admission, keep eligible overlapping tasks in durable order, and expose area and dependency wait reasons in status, wait and Board views. Free held areas on completion, safe release or a reviewed, green PR’s merge wait. Add `areaMergeWaitMs` to Fleet policy and host configuration with a 30-minute default from readiness; delivery observation continues after that wait.
- Admit `depends_on` targets without Fleet records when their Board status is `done`; targets with Fleet records still require accepted completion for the current Board revision.
- Add `reportPayload` and `reportPayloadFile` to persist and recover the first complete publication payload under a report's immutable identity.
- Add `ReportAttachments`, `UnavailableAttachment`, attachment directory/marker constants and `declaredAttachments` in `reportAttachments.ts`; `codexReportAttachments` and `makeCodexReportAttachments` fetch turn files, `reportFileChanges` and `reportFileReplay` reconstruct them, and `applyReportPatch` validates update hunks.
- The daemon contract exposes `daemon.status`, `daemon.dispatch` (including approved Board preparation) and one scoped `daemon.follow` stream of compact snapshots. Followers subscribe before the initial read, resync on reconnect and preserve terminal summaries, exit codes and deduplicated watch output.
- `work-fleet decide <work-id> retry|release` answers the current published Fleet decision through the daemon without looking up question or response IDs. The daemon contract adds `daemon.decide`, `daemon.release` and `daemon.name-threads`; host helpers expose scoped `daemonRequest`, `decideWork`, `releaseItems`, `withDecisionResponses`, `recordDecisionResponse` and `nameStoredThreads` for this path.
- `host/actionCommands.ts` exports the native CLI definitions `continueCommand`, `releaseCommand`, `reassignCommand`, `nameThreadsCommand` and `decideCommand` for subcommand composition.
- `SessionFailure` and persisted `Attempt` expose optional `terminalReceipts: readonly SessionReceipt[]`. The native Codex adapter reports all matching receipts for ambiguous duplicate terminal turns, and release verifies each receipt after restart before retiring the attempt. Retry and release retire lost thread acknowledgement intents with a durable fence against late session and turn acknowledgements.
- Add `work-fleet serve <board-dir> [--port <port>]` and the scoped `daemonLayer` / `serveFleet` host API, with `DAEMON_HOST` and `DAEMON_PORT` defaults. One Fleet host, bounded PostgreSQL pool and provider connection set serve the scheduler and concurrent HTTP RPC clients; closing the daemon releases them. A listener collision fails before scheduling work.
- Expose existing effect-contract Fleet operations through `DaemonContract`, `RPC_PATH` and the `daemonRpc` server Layer at `/_fleet/rpc` over native NDJSON HTTP, with Platform request tracing. Bind to `127.0.0.1:3457` by default and accept only loopback Host values, missing or same-origin transport Origin and NDJSON requests. Restart uses the existing durable launch recovery, retaining uncertain ownership when a thread was not acknowledged.
- Expose `hostScheduler` for scheduling with an already provided host Layer; `runFleet` retains its embedded scheduler behavior.
- Fleet marks a Board task done when its work completes or a human merges its PR. It rewrites only `status` and `next_action`, names the merged PR, recorded report or no-change result, and leaves the brief and its revision unchanged.
- Treat passing required checks at the reviewed head as CI evidence when job logs or artifacts are unavailable, with the limitation recorded in reviewer evidence. Ask once for a malformed verdict on the same reviewer thread before requiring a human; persist and reconcile that follow-up across restart.
- Adopt PRs already merged at the reported head, including merges during review, then require independent approval and checks for that head before accepting observed human delivery. Retry failed adoption from the completed worker receipt instead of launching another worker; keep mismatched merges and unmerged closures waiting for a human.
- Recover interrupted Cloud launches on the acknowledged thread: adopt matching accepted turns, wait five seconds for late acceptance, then start the saved turn only when the thread remains empty. Guided retry uses the same recovery for existing missing-turn decisions and retains the attempt identity; uncertain thread evidence stays blocked.
- Check complete report bytes, including attachment links, before writing attachment files, so oversized reports leave no attachment folder. Name launching threads with one record lookup using the work ID retained from session acknowledgement.
- Name Cloud threads from their Board work ID and first heading, with bounded titles and reviewer or separate repair labels. Add best-effort `work-fleet name-threads` backfill with per-session results and idempotent repeat runs.
- Select dispatch and reconciliation candidates from one scheduler-cycle snapshot, so a new launch cannot race with reconciliation of its receipt.
- End each scheduler Board read pass before sleeping; late reconciliation reads current Board context instead of reusing the pre-sleep snapshot.
- Check the complete report’s UTF-8 size against Board’s 256 KiB context limit before publication. Oversized reports need a human with a concrete reason, and successful reports are visible in the current read pass.
- Allow reviewer shell network reads for PR diffs and exact-head CI through `gh`, retaining read-only filesystem access, no escalation and instructions prohibiting network writes.
- Breaking: remove the unused `authorize` and `merge` hooks from `FleetIntegrations` and the obsolete `deliverySubmitted` field from Fleet records and archived cycles.
- Breaking: `hostIntegrations` now takes a `FleetHost` and returns its integration Layer. It selects result adoption while retaining GitHub checks and human delivery observation.
- Accept surrounding whitespace and backtick-wrapped values in the final worker head and PR markers. Preserve no-change evidence when main moves; adopting it still requires the task revision to match the revision dispatched.
- Reject ambiguous attachment modes and non-regular or escaping reconstructed paths before reading files. Limit report diff text to 8 MiB, task downloads to 16 MiB, attachment count to 64 and total attachment bytes to 32 MiB; rejected reports need a human with the failed limit named.
- Download new uncommitted report files from the completed Cloud task diff beside the Board result, including text and Git binary patches. Reject report workers that publish their branch or open a PR on GitHub, without deleting public evidence. Unavailable downloads or remote checks need a human.
- Publish structured provider capacity codes without raw upstream text and refresh health after each scheduler pass.
- Atomically publish versioned Fleet health snapshots beside the status board using Board's shared schema. Report execution occupancy, prepared queue and needs-human counts against host concurrency, retain scheduler and structured provider capacity observations across restart, and keep publication failures separate from execution outcomes. Reuse Board's read-only Codex app-server rate-limit reader for host quota.
- Wait for a human merge after exact-head review and checks; Fleet never submits a merge.
- Observe the adopted GitHub PR through the host’s GitHub CLI, record its reviewed head and merge revision, and release ownership after acceptance, including after restart.
- Keep closed unmerged PRs and uncertain or mismatched delivery evidence in Needs human with a concrete reason.
- Preserve the current Board decision and ownership when GitHub delivery observation is temporarily unavailable.
- Hide resolved delivery decisions in completed views while retaining the original decision in detailed records.
- Start Cloud turns even when thread naming is rejected or times out; naming and archive-cleanup failure warnings include the session ID and cause.
- Follow multiple items with `work-fleet watch [ids...]`, emitting one line per completed, needs-human or released item. With no IDs, follow the active items at startup. Watch and wait read only summary fields in one PostgreSQL query per poll; wait retains its exit codes.
- Generate `fleet/status.md` from the CLI host's Fleet views, with Active, Needs human and Done heading columns, task and adopted PR links, and live Work Board updates. Preserve authored sources and retry failed publication without changing execution outcomes.
- Publish stopped worker questions through Board and continue the same thread with the recorded answer, using a durable submission intent to prevent repeated continuation after concurrent resolution, restart or a lost acknowledgement.
- Read GitHub check runs and commit statuses for the adopted PR's exact SHA, retain
  pending checks in validation and send failed check names and links to repair.
- Replace host review callbacks with independent reviewer sessions using host model settings. Reviewers receive the task and exact PR head with read-only execution, shell network reads and no escalation.
- Record completed machine-readable reviewer verdicts with evidence and findings
  against the exact revision. Reconcile lost responses and require fresh review
  after the PR head moves.
- Archive Codex Cloud worker and reviewer threads after accepted completion or safe release, retain repairable conversations, and retry failed cleanup without repeating delivery.
- Configure Cloud thread naming with `cloud.threadNamePrefix` (default `Fleet: `), project assignment with `cloud.projectId`, and opt out of cleanup with `cloud.archiveThreads: false`.
- Add `fleet-deliverable: report`: workers return the whole report in their final message, and Fleet records an immutable Board result with the task relationship and exact session/turn receipt. Reports complete without PR adoption, review, checks or delivery; empty output needs a human. Publication retries reuse the same result identity.
- Add the `work-fleet` command: `run` schedules approved Board work, `dispatch`
  launches one item, `status` lists active, done and needs-human work, and `wait`
  blocks on one item and exits with its outcome. Host settings come from a
  `fleet.config.json` in the Board folder.
- Approve Board work with `fleet: approved` frontmatter on the exact revision read.
- Launch Codex Cloud workers through a hosted provider with model, reasoning effort
  and service tier from host config, overridable per item, and read their final output.
- Select GitHub worker-result adoption in host configuration. Require a final PR marker and exact reported head, record the observed PR number and paginated changed paths, and reject closed PRs or revision movement. Reported no-change still requires independent review and validation.
- Remove owned-path overlap blocking; overlapping work runs and Git resolves conflicts.
- Dispatch prepared work concurrently.
- Continue terminal needs-human or completed work on its existing worker thread with `work-fleet continue <id> <message>` or a message on stdin. Persist each message and attempt before submission, preserve the prior cycle in history, and reconcile lost acknowledgements without replay. Status and wait follow the continued turn and result; running and released work cannot be continued.
- Continue work waiting on a human merge on its existing worker thread, retaining the reviewed head in history and PR ownership until the new result is adopted.
- Add the optional Board-backed Fleet core with PostgreSQL attempt attachments,
  transactional reservations, session/turn receipts and native command/query contracts.
- Carry approved work through independent revision-bound review, repair, validation,
  authorized delivery or evidenced no-change; expose derived human views and Board questions.
- Preserve compatible preparation evidence across unrelated main changes and retain
  ownership through ambiguous submission and delivery for restart reconciliation.
- Consume exact current Board responses through guided retry/release decisions,
  preserve clarification and deferral blockers, and acknowledge response IDs durably
  without granting authority from author labels or answer text.
- Renew approved work under its existing Board ID with archived context and evidence,
  preserve unresolved result ownership, and require dependencies' current revisions
  to have accepted outcomes.
- Acknowledge applied or superseded managed Board requests after SQL commits, using
  immutable qualified receipts and persisted publication markers; retry pending
  acknowledgement without repeating actions or rewriting reviewed source.
- Retain unresolved session ownership when the provider becomes unavailable after acknowledging a session, or creates a thread with mismatched launch settings.
- Add schema-derived storage model and row-codec helpers in `storage/model.ts`, plus `modelTables`, `nextAdmissionOrder`, `checkRecordAdmission` and the generic `FleetStoreOptions<A>` type. `migrateFleet(namespace, schema?, legacyOnly?)` accepts a record schema for additional columns and can run the legacy migration batch independently.
- Add `recordValue(row, columns)` and `recordValues(rows, columns)` to decode storage fields before record-schema validation, and `Fleet.hasLaunchRetry()` (also available on the store) to query queued retry presence through a repository projection. Add `admissionReads(options, record, previous, limits)`, `FleetStoreOptions.admissionNeedsRecords(record, previous, limits)` and `needsAreaRecords(...)` so applications can omit unused admission snapshots while retaining locked capacity and quota checks.
- Add `publishAfterBoardPass(publication)` to coalesce status publication within a Board read pass and publish when it ends, including a failed pass. Calls outside a pass publish immediately.
- Add the store’s `operationEntries(operationId)` projection and `operationEntries(rows, operationId)` / `operationRecord(store, operationId)` helpers to bind receipt acknowledgment to a unique current or archived operation and its record version. Custom repositories can retain the existing full-record lookup.
- Fleet records and cycle snapshots include optional `conflictRepairs: readonly string[]` revision receipts for automatic conflict repair.
- GitHub delivery observation exposes `ConflictingPr extends FleetFailure` with a `mainRevision: string` when an open PR at the adopted head conflicts with its base.
- Configure repository-specific reviewer instructions with `worker.reviewerGuidance` in the host config, as inline text or a `{ "file": "…" }` path relative to the Board folder. The host supplies the text through `FleetPolicy.reviewerGuidance` to initial reviewer prompts and verdict follow-ups.
- Release several terminal needs-human items with `work-fleet release <id>... --board <board-dir>`, recording closing responses for their decisions, including done and deferred tasks.
- Configure repository-specific worker instructions with `worker.workerGuidance` as inline text or a `{ "file": "worker.md" }` path relative to the Board folder. Fleet includes the resolved text in initial worker prompts, repair turns, manual continuations and report corrections. An unreadable file fails host policy creation.

### Changed

- `status` prints each waiting question or reason followed by its `work-fleet answer` command, including a non-default daemon port. Republished decisions are registered against their current source before answering.
- Route routine worker questions, result inspection, report limits and terminal reviewer failures to the orchestrator. Explicit maintainer questions and reviewed PRs ready to merge wait on the maintainer; missing integrations and pending checks wait on automation. Dependency qualification waits on the orchestrator. Reassign an exact waiting decision through Fleet, native RPC or the CLI while preserving reviewed sources and superseding the old question durably.
- Notable: no-change validation without a configured host validator waits on automation with `No-change validation is not configured` instead of a generic GitHub-check failure.
- Keep terminal work visible while Board acknowledgements are pending.
- `release`, `reassign`, `continue` and `name-threads` use the running daemon and accept `--port`, sharing its runtime instead of connecting to PostgreSQL from the CLI. Client `--board` and `--config` flags do not select a host. Thread naming returns rename and failure messages to the caller.
- `pg` is a test dependency. Read-only test connection setup lives in test support; daemon status reads use `recordPayloads`.
- Extend `DaemonContract` with `daemon.diagnostics` on the existing daemon RPC endpoint, with in-memory health observations and shared one-minute Codex/GitHub rate-limit caching. The `host/daemonDiagnostics.ts` handler Layer supplies this query.
- Add `HealthSnapshot` to the services provided by `statusLayer`; health remains available to RPC clients when its file is missing or publication fails.
- Persist Fleet records and foreign reservations through effect-sql model repositories. Startup migrates existing JSONB records into field columns, retaining record versions, admission order and nested values. Daemon reads and writes continue against migrated PostgreSQL storage.
- PostgreSQL tests share prepared Fleet migrations through effect-test-sql, with rollback for ordinary tests and cloned databases for real commits.
- Dispatch prepared work sequentially and keep queue-full launch rejections queued with durable exponential backoff from 30 seconds up to five minutes. Stop scheduler dispatch for the pass and show the last rejection time while waiting for provider capacity. Continuation retries keep their saved message, launch settings and existing worker thread.
- Default reviewer prompts no longer include Platform-specific PostgreSQL commands, environment variables or source paths. Hosts supply their own validation guidance.
- The Fleet daemon uses Platform's local-only RPC guard for its NDJSON HTTP endpoint. Local RPC clients remain supported; cross-origin, rebinding Host and non-NDJSON requests receive HTTP 403.

### Fixed

- Answers exceeding Board's 32768-character input limit are rejected before response publication, leaving the waiting question available for a valid answer or release.
- Migrate legacy published questions and ready-to-merge decisions to the maintainer on both the record and decision. Recover publication receipts and read recorded Board answers before changing an owner, preserving answers during upgrade.
- Retry a committed reassignment by its original decision ID after a lost acknowledgement without publishing again. Competing reassignment and resolution writes fail with a typed stale decision.
- Archive owners and supersession receipts when work continues without carrying those receipts into the new cycle or acknowledging them twice.
- Scope changes detected before or after a reviewer verdict publish approval requests to the maintainer and appear in maintainer waits.
- Persist provider launch backpressure waits under automation, including during upgrade, and clear the owner after a retry is accepted.
- Board read failures name the file and problem. Invalid unrelated files no longer block admission or send running work to a human decision; Fleet records the problems and retries the files on the next pass.
- Board context checks cover the worker's own brief. Linked documents and unrelated bookkeeping leave preparation, execution and review running. Approved brief edits refresh preparation or continue the existing worker after its turn ends, with the changed brief; removed approval and done or superseded work still stop execution.
- Worker answers survive Board edits and reach the existing thread with the current brief. Provider queue retries retain the pending prompt, role, session, settings and backoff across approved brief edits, including host admission before initial launch retries, appending the brief update on retry. Responses from the same author use the newest response; competing authors still require explicit resolution.
- Retry prepares the current approved brief, and released work can dispatch again under the same item identity while retaining its previous cycle and known PR reservations.
- CLI-watch tests await the first daemon snapshot before editing its selected work, removing a startup race.
- Report publication retries reuse a durable payload, including attachment bytes and unavailable-file warnings, after restart or a lost acknowledgement even when Cloud retrieval changes.
- Reconstruct private report attachments from the exact completed Cloud turn’s paginated app-server `fileChange` items, replaying adds, updates, moves and deletes under `/tmp/fleet-report/attachments/`. Require file-edit/apply_patch writes and explicit attachment declarations in report prompts; binary evidence uses base64 text. Publish report text and unavailable-file reasons when retrieval, reconstruction or collection limits fail, while retaining retrievable files after per-file failures.
- Require continued work to reacquire its areas before resuming the existing worker thread, including after a human merge wait expires.
- Retry starts a fresh reviewer after repeated malformed verdicts, requests a corrected worker report when the reported PR head moved, recovers missing completed-worker receipts and resumes delivery failures at delivery. Retry of a moved-head delivery decision refreshes the current PR and starts a new independent review even when prior review evidence is missing or stale.
- Decisions that require fresh preparation, changed ownership, a shorter immutable report, configured no-change validation, reversal of GitHub report publication or a human merge offer only release and explain why retry cannot make progress. Release observes unresolved execution without submitting a turn and retains ownership unless every known turn is confirmed terminal or an unacknowledged intent is durably fenced before a turn can start.
- The PostgreSQL recovery matrix follows production source references and tests Board report publication, attachment and saved-payload failures after restart, including a closed published PR whose branch has been deleted. Provider failure rows use a synthetic transport; Board rows invoke production report boundaries. Existing-producer, reason-factory fallback and newly referenced Board-producer mutations require new matrix entries. A native SQL connection failure at the repository write boundary also recovers after restart.
- Preserve dependency acceptance when completed Fleet work is marked `status: done` and its `next_action` records completion, while still blocking changed criteria or body and released or unfinished work.
- Fleet notices when a human merges its PR or closes its Board task as done, superseded or deferred. It releases the item, supersedes the open Board request and frees the PR reservation, instead of waiting for an orchestrator or starting a repair. Reviewed work with passing checks still completes at the accepted head.
- Daemon followers retain their last snapshot through transient PostgreSQL read failures and fail with a clear message after 20 consecutive attempts. The shared snapshot poller reads only while followers are subscribed and restarts with fresh state after becoming idle.
- Review refresh retains the preceding worker receipt when a follow-up fails without a receipt, including archived continuation cycles. PostgreSQL regressions cover retry, fresh review and observed delivery after a completed repair.
- Codex follow-up submissions wait for an active thread turn to finish and continue the same attempt, with polling delays doubling from two to thirty seconds. A five-minute deadline and three-resubmission cap route persistent rejection to a human decision and release execution capacity. PostgreSQL regressions with a synthetic provider cover continuation and deadline recovery; a wire-protocol regression covers the resubmission cap.
- Limit worker launch acknowledgement waits to one second, preserving unresolved attempts for reconciliation while later launches continue in the same scheduler pass. Explicit queue-full rejections still stop the pass.
- Reuse a started thread after its first turn is explicitly rejected instead of leaving it behind when retrying on a fresh thread.
- Preserve `$&`, `$$`, `` $` `` and `$'` literally in task text when refreshing a worker prompt after a Board edit.
- Workers and reviewers accept green checks on the exact branch head while the merge queue validates against latest main. PR adoption tolerates main advancing with unchanged head and changed paths, and reviewed, conflict-free work behind main waits for human delivery without repeating review or validation.
- Accept schema-encoded objects in `recordInput` as well as JSON strings, avoiding a whole-record JSON round trip before model validation.
- Avoid unchanged preparation writes, repeated full-record decoding and status publication within scheduler passes. Task discovery skips the generated Fleet status view and retains authored work at the same path. The real-PostgreSQL scheduler test admits and launches 100 tasks within five seconds with one metadata parse per task.
- Automatically start an independent review of the current PR head when delivery observation finds a push after approval. Keep the prior result and review, clear stale checks, recover before reviewer launch after restart, and route retry of a stored moved-head decision through current PR observation instead of the old worker report.
- Ready-to-merge decisions answered with retry and an overall response send the requested changes to the existing worker thread and PR, followed by independent review and checks of its new result. Empty responses retain delivery retry behavior.
- Approved PRs reported as conflicting by GitHub request a main merge from their worker once per conflicting main revision, including across restart. PRs that are only behind main retain approval.
- Retrying a PR conflict decision, with or without response text, sends the existing PR to its worker to merge main and push before another review.
- Retrying a repair rejected at the Codex active-turn resubmission limit starts a fresh thread for the same branch and PR, retaining that intent across restart.
- Apply release answers after task content or location changes without requiring current approval. Stale retry closes its decision and publishes one replacement for the current revision, with publication and acknowledgement recovery after restart.
- `work-fleet watch --follow` reports current needs-human waits from its first snapshot, including a review that finishes while the watch connects, and reports readiness again after repair. Unchanged waits stay quiet across daemon reconnects.
- `work-fleet watch --follow` records initial history without printing it and stays quiet for unchanged items after reconnecting to a restarted daemon.
- Give malformed completed worker reports one automatic correction turn on the same thread before requiring a human. A guided retry requests a corrected report in a new turn. Persist correction intents before submission and reconcile lost acknowledgements after restart.

### Breaking

- Removed `work-fleet decide`, `daemon.decide`, `decideWork` from `host/decideWork.ts`, and `decideCommand` from `host/actionCommands.ts`. Use `answer`, `daemon.answer`, `answerWork`, and `answerCommand` instead.
- Replace the single waiting view with `waiting.maintainer`, `waiting.orchestrator` and `waiting.automation`. Persist `attentionOwner` on waiting records; group status and generated Board views by owner and change wait/watch summaries to name the owner. Stage values and wait exit codes are unchanged.
- Publish version 2 Fleet health snapshots with waiting counts per owner. Area, capacity and quota waits belong to automation.
- `reportBoard` collectors now receive `SessionObservation` and return `ReportAttachments` with `files` and `unavailable`; `ReportFile` moves to `reportAttachments.ts`. Remove the obsolete `codexTaskDiff`, `makeCodexTaskDiff`, `readTaskResponse` and `reportDiffFiles` exports and their REST/Git-patch modules. `codexTurns` exposes shared bounded `readItems` pagination in addition to `readOutput`; `reportLinks` accepts optional unavailable-file records.
- `status`, `dispatch`, `wait` and `watch` require a running local daemon and accept `--port` (3457 by default). They no longer load host configuration or connect to PostgreSQL; retained `--board` and `--config` flags do not select a daemon. An unavailable daemon exits 1 with startup instructions.
- `WaitOptions` and `WatchOptions` replace `databaseUrl` and `namespace` with optional `port`; `intervalMs` and CLI `--interval` now control reconnect delay. `readWaitStates` uses an existing Effect SQL service, takes namespace-only read options and returns all states when IDs are omitted. `daemonRpc` is now a factory accepting the host configuration.
- Remove the `work-fleet run` CLI command. Use `work-fleet serve` to schedule approved work and expose local HTTP RPC.
