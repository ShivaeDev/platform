# @shivaedev/work-fleet

Work Fleet launches approved Work Board items and keeps execution receipts in PostgreSQL. Use its command to schedule workers and inspect progress, or compose its Effect services with your own result, validation and delivery integrations.

## Keep approved work moving

Approve an item in Board, then let Fleet admit it and observe its worker. Waiting views name who must act: the maintainer, the orchestrator or automation.

```sh
work-fleet serve <board-dir>
```

## Use the command

Board owns authored work and its revision. Fleet stores preparation, attempts and outcomes against that identity in PostgreSQL. A terminal worker turn is execution evidence; accepted completion also needs result adoption, review when enabled, checks and an observed human merge of the validated head, or validated no-change. Fleet's tests run against real PostgreSQL with synthetic Codex, Cloud and GitHub servers; they do not prove live hosted Cloud execution, review, GitHub adoption or delivery.

### Shared work vocabulary

| Concept | Words |
| --- | --- |
| Board document kind | `goal`, `task`, `question`, `report` |
| Authored Board status | `draft`, `ready`, `done`, `deferred`, `dropped` |
| Fleet stage | `queued`, `working`, `reviewing`, `waiting`, `done`, `released` |

The [Board vocabulary](../work-board/README.md#work-vocabulary) defines each authored state's meaning, approval, ownership, deliverables and question fields. Fleet keeps resumable execution steps in `record.step` beneath the shared `record.stage`. Stored records, status files, CLI and MCP projections use the same stages. Every wait names its owner and reason; a predicted conflict hold names the PR to merge and the conflicting files. Fleet's database migration upgrades current and archived stages at startup.

Run `work-board migrate <board dir>` before starting this version with an existing Board. Board and Fleet refuse old vocabulary and name the affected file and field. Migration preserves published decision revisions, registered questions, recorded answers and request receipts across the vocabulary rewrite. Answered and settled asks retain their state; an edit to the question itself still invalidates its reviewed context. Approval remains separate from status: Fleet runs only `fleet: approved` tasks; `held` waits on a person and `manual` leaves the task to its owner. PR tasks default to `delivers: pr`; research tasks use `delivers: report`.

### Configure the host

Put `fleet.config.json` in the Board folder. For `serve`, `--config <file>` selects another configuration file. A Cloud host needs both `cloud` and `worker` settings:

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

Set top-level `review` in `fleet.config.json` to `false` (off), `"advisory"` (review without sending findings back to the worker), or `true` (blocking, the default when omitted). Off sends delivered PRs straight to required check validation. Advisory runs the independent reviewer, records its verdict and continues to required check validation and the existing ready-to-merge decision even when it requests changes or returns a malformed reply. Blocking sends requested changes to repair. A config edit applies to results that have not yet entered review; the choice for an adopted head survives daemon restart and later config edits. Reviews already started continue.

Set optional `worker.workerGuidance` to repository-specific worker instructions. It accepts inline text or `{ "file": "worker.md" }` with the same validation as `worker.reviewerGuidance`; file paths resolve from the Board folder. An unreadable file fails host policy creation. Fleet includes the text in every worker prompt, including first turns, review and check repairs, manual continuations and report corrections. When unset, Fleet adds no worker guidance.

Set optional `worker.reviewerGuidance` to repository-specific review instructions. It accepts inline text or `{ "file": "reviewer.md" }`; file paths resolve from the Board folder. An unreadable file fails host policy creation. The host includes the text in initial reviewer prompts and verdict follow-ups. Omitted guidance leaves the default prompt repository-independent.

A `worker` section with both kinds of guidance looks like this:

```json
{
  "worker": {
    "branchPrefix": "<branch-prefix>",
    "sharedEnvironment": "<environment-script-path>",
    "workerGuidance": { "file": "<worker-guidance-file>" },
    "reviewerGuidance": "<review instructions for your repository>"
  }
}
```

The host defaults to `concurrency: 100`, `backlog: 100`, `namespace: "work_fleet"`, `quota: "codex"`, an empty `launch` and no `openPullRequests` curve. `concurrency` limits execution; `backlog` limits undelivered adopted changes; `openPullRequests` slows new implementer launches as Fleet's open PRs pile up, as described under [Pace new work by open PRs](#pace-new-work-by-open-prs). The Codex quota policy uses ordinary-usage eligibility and caches observations for a minute; `quota: "unlimited"` admits without that provider limit. An unknown quota response fails rather than granting capacity.

`stallMinutes` is a positive integer, defaulting to 30. Fleet records each running turn's item count and statuses; added items or changed statuses reset its progress timer. One idle interval sends a Codex steer asking the worker to continue or stop with a question. A second idle interval interrupts the turn; after observing it interrupted, Fleet continues the same thread with the retry prompt. A third idle interval publishes an orchestrator decision. Progress times and recovery stages persist across host restart. CLI status and the generated status page show each turn's last progress time and Fleet's steer and interrupt timestamps.

Without a publication integration, a missing acknowledged turn stays under observation for five minutes after its first absence or the latest thread progress. Changed items or statuses on an older or newer running turn extend this grace period. If the turn remains invisible without progress, Fleet resumes its existing thread once. Observing that resumed turn clears the consecutive-loss count; a second consecutive loss asks the orchestrator. The grace timer and retry count persist across restart.

When the provider cannot find an accepted worker or repair turn, Fleet checks that its thread is idle before replacing it. An active thread retains execution ownership for a five-minute visibility grace period, then needs a decision if it is still active. Fleet checks the item’s remote branch and all PR states. With neither published, it records the missing-turn evidence, retires that execution and relaunches automatically. With a branch or open PR, it starts a repair turn on a fresh thread and instructs it to reuse that branch and PR. A merged or closed PR prevents relaunch and needs delivery inspection. A confirmed branch or PR is enough even if the other read fails; inconclusive publication reads need a decision. Every lost turn rechecks current thread and publication state, including a lost repair after a completed replacement. Idle threads with conclusive publication evidence recover automatically again. Answers recheck thread and publication state, and reach the replacement turn when safe. A quota wait retains the original lost intent until its replacement is admitted; retirement and the replacement intent save together. Relaunch prompts contain the original brief and one recovery note; the saved brief stays unchanged. Status and watch show the recovery reason while the replacement turn executes; the notice clears when work advances to review. Composed hosts provide publication evidence through optional `FleetIntegrations.publication(work)`, returning `WorkPublication` with `branch`, `remoteBranch`, optional `pullRequest` and `pullRequestState` (`open`, `closed` or `merged`); a PR with unknown state needs a decision.

Missing or invalid configuration fails.

Scheduler dispatch submits queued items in sequence and stops the pass after a transient provider rejection. Worker and repair launches wait up to one second for acknowledgement after persisting their intent; missing replies retain execution ownership while the pass continues dispatching. The provider request continues in the service scope so late replies are persisted, and reconciliation waits for that request to finish before recovering the operation. Explicit caller interruption still cancels the submission. Rejected work releases execution capacity and retries on later passes with durable delays of 30, 60, 120 and 240 seconds. Queue-full, structured provider capacity failures and the explicit “Selected model is at capacity” rejection receive at most five attempts. Failed worker and reviewer turns with those capacity failures use the same retry budget. When it runs out, Fleet parks the item with the provider failure and the number of attempts. The waiting item is tried before the rest of the queued backlog, so provider capacity backoff also pauses that backlog. `work-fleet status` shows waiting for provider capacity with the last rejection time and next retry time. Rejected credentials and refused policy still require a human decision; ambiguous submissions retain their existing ownership for reconciliation. A retry after an explicitly rejected first turn reuses the acknowledged thread.

A capacity rejection while reading or reconciling a turn does not establish that its submission failed. Fleet backs off those reads on the existing operation, retaining the attempt, receipt and execution reservation across restart. Reads use a separate five-attempt budget with delays of 30, 60, 120 and 240 seconds; a successful observation clears that wait. `readRetryMs` in Fleet policy or `fleet.config.json` sets the first delay, defaulting to `30000`, and each later delay doubles it; integration evidence reads use the same schedule. Exhaustion parks with the provider read failure and attempt count while retaining execution ownership. A human retry reconciles that operation; it does not launch a replacement.

A review with a lost thread acknowledgement or an unobservable submitted turn is safe to repeat because it changes no code. When its provider read budget runs out, or reconciliation reports `session-turn-missing` without a pending read retry, Fleet retires the unacknowledged review and queues a fresh read-only thread for the same head under the shared five-attempt provider retry budget. Late acknowledgements of the retired attempt are rejected. Lost worker and repair threads still retain execution ownership and require a human decision after read exhaustion.

### Start the local daemon

`work-fleet serve <board-dir>` binds to `127.0.0.1:3457`; `--port <port>` selects another port. The daemon composes `Fleet.layer`, the host and scheduler once for its lifetime. Its HTTP clients share one PostgreSQL admission pool, bounded by `database.maxConnections` (20 by default, at least 2), and one provider connection set. One admission-pool connection is reserved for the PostgreSQL change listener; the remaining connections serve queries and transactions. The daemon opens one additional receipt connection for answer recording, status and follower snapshots, so admission waiters cannot consume their database capacity. Fleet record commits notify followers through PostgreSQL, including followers in another host runtime. A listener resync refreshes their stored-state snapshots. Work Board runs independently.

Native Effect HTTP RPC uses NDJSON at `/_fleet/rpc`. Import `DaemonContract` from `@shivaedev/work-fleet/host/daemonContract.ts` and provide `RpcClient.layerProtocolHttp` with `RpcSerialization.layerNdjson` and an HTTP client. The contract exposes Fleet's existing prepare, dispatch, continue, reconcile, resolve, reassign, get and views operations, plus `daemon.dispatch` for explicit Board dispatch, `daemon.dispatch-status` for its receipt, `daemon.status` for filtered views and the `daemon.follow` snapshot stream. Platform's `RequestTracing` supplies a request id for each call, preserving valid `x-request-id` values. Only loopback Host values and missing or same-origin transport Origin headers are accepted; requests must use `application/ndjson`.

`work-fleet dispatch <id>` validates Board approval, saves a dispatch receipt in PostgreSQL and replies before refreshing remote main, preparing execution or contacting the provider. `daemon.dispatch` returns a `DispatchRequest` with `id`, `workId`, `acceptedAt` and `status`; `daemon.dispatch-status` reads the latest receipt for an item. Pending duplicate requests share that receipt. Background processing records `completedAt` and either `status: completed` or `status: failed` with an `error`. Completion here means dispatch processing finished; the work's execution stage remains separate. `status` includes pending and failed receipts in `FleetViews.dispatches`, and `watch` waits through pending preparation and reports a background refresh failure even when no execution record exists. When the scheduler recovers after a failed dispatch, watch preserves the current execution and terminal outcome instead of showing the old dispatch failure. The failed receipt remains available through `daemon.dispatch-status`. Pending receipts resume when the daemon restarts; dispatching a failed request creates a new receipt.

Compose `daemonLayer(host, parts, port)` in a scoped host, or launch it with `serveFleet(host, parts, port)`, both from `@shivaedev/work-fleet/host/daemon.ts`. The daemon uses Platform’s `appHost` with the loopback policy and its existing RPC path. Its shared `appDatabase` layer completes Fleet migrations in the namespace ledger before acquiring application services. The listener starts before scheduling. Closing the scope stops scheduling and HTTP, then closes the provider services and pool. Restart recovery reuses saved launch intents and acknowledged threads; retry or release fences late acknowledgements and retires an intent without a persisted thread acknowledgement before a turn can start. A migration failure prevents provider acquisition and scheduling.

### Edit the configuration while the daemon runs

The daemon watches its `fleet.config.json` (or the `--config` file) and applies a valid edit without a restart. `concurrency`, `backlog`, `intervalSeconds`, `quota`, `launch`, `openPullRequests`, `stallMinutes`, `areaMergeWaitMs`, `readRetryMs`, `review`, `worker.workerGuidance` and `worker.reviewerGuidance` take effect on the next scheduler pass or launch; an applied edit starts that pass at once. Running turns keep the launch settings they started with, and work that already holds capacity keeps running after `concurrency` is lowered. Every other setting, such as `provider`, `database`, `namespace`, `cloud`, `local`, `repository`, `result`, `worker.branchPrefix` and `worker.sharedEnvironment`, keeps its running value: the daemon logs a warning and lists the changed paths as needing a restart. An edit saved by replacing the file keeps applying.

An edit that fails validation, is partly written, cannot be read, or names an unreadable guidance file keeps the last good config. The daemon logs a `HostConfigRejected` warning that names the failing field, and the next valid edit applies. A rejected edit never stops the daemon or drops tracked work.

`work-fleet status` lists all active and waiting work with its stage, blocker, attention owner, links and PR, followed by at most 50 done items, newest first by completion time (falling back to update time, then work id). The overview reads operator fields without prompts, Board context, archived cycles or worker output. Overview decisions omit `publicationWork` and `published`; request `work-fleet status <id> --json` (RPC `daemon.status` with `workId`) for the full record in `record`, including older done work. The filtered view sections remain available beside that record.

`work-fleet status` ends with the config the daemon applies now: when and from which file it was loaded, the provider and the reloadable settings with their defaults filled in, the paths waiting for a restart and the last rejected edit. `--json` carries the same view as `config`, with the database URL left out.

### Approve work and override launch settings

Set the exact `fleet: approved` value in the item's frontmatter. Missing approval or `fleet: held` does not approve it. The optional `fleet-launch` object overrides host `launch` settings per field:

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

The launch fields are strings. Omitted fields inherit the host settings; without host settings or an override, they inherit provider defaults. An invalid override fails before dispatch. The selected settings also apply to repair turns.

Fleet treats `done`, `deferred` and `dropped` as closed. Closed tasks are never admitted; queued or waiting work is released once its execution is confirmed terminal.

Cloud worker prompts open with the repository README's first prose paragraph, then the titles and bodies of goals reached through `implements` relationships, then the task's title and body, areas and acceptance criteria as readable lists. They omit Board bookkeeping frontmatter. Repository worker guidance and Fleet's startup, evidence, question and final-report protocol follow that context. The work revision used for approval and review still covers only the item's own authored content; editing a linked goal, plan, report or decision, or an unrelated item, does not change that revision. When queued or working items have no open decision, Fleet approves an edited brief in place on the next pass if it still has `fleet: approved`, its owner is omitted or `codex`, and its status is not `done`, `deferred` or `dropped`. The worker keeps its session, turn and PR without a Board context changed decision. A changed brief that fails these conditions still stops for a human. When that happens before the first launch, the decision card says the edit, such as an owner other than Codex, is one Fleet cannot accept by itself, and asks to undo the edit and try again or hand the task back; retry starts the work once the task matches what Fleet prepared. `work-fleet dispatch <id>` can explicitly approve the current approved brief in place, even while its worker turn runs. Retry on the context decision approves the brief that decision was published against; an answer to a decision from before an edit cannot approve the new brief. Approval updates the stored context and prompt, closes the decision and preserves the current thread and PR. A retry answer closes it with one applied receipt for that answer; dispatch closes it as superseded. Fleet records at most one receipt per question. When the worker or repair turn has an active receipt, Fleet steers it through the existing provider steer operation with a summary of the changes followed by the full new brief. Each authored revision is attempted at most once per turn, including after restart or a brief reverting to a previously steered revision. The approved brief and steer intent commit together before the provider call. CLI status records the request time, acknowledged delivery time or failure; interrupted delivery remains unconfirmed and is not replayed. Unsupported or failed steering leaves the updated brief in place for independent review and later repairs on the same worker thread. Completed turns and reviewers receive no brief steer. Removing approval stops further execution. Changing a working item's `status` does not interrupt it. Running work retains ownership until normal completion or a confirmed safe release. Uncertain provider receipts retain ownership for reconciliation.

Cloud hosts compute the Board directory's repository-relative path only when that directory is inside the repository and git-ignored. Before launching, Fleet checks each criterion's text for that path. A match publishes an orchestrator decision naming the criteria and explaining that Cloud workers cannot read local-only Board data, without starting a session. Edit the criteria to use data available to the worker, then dispatch again. Local workers, Board directories outside the repository, directories that are not ignored, and paths mentioned only in the body do not trigger this guard.

### Sweeps

A task that migrates a shared catalog, release-note format or repository-wide name can declare `sweep` as a nonempty list of repository-relative path globs:

```yaml
sweep: ["packages/*/changes/**", "pnpm-workspace.yaml", "**/package.json"]
```

Use `sweep: ['*']` to cover every path. Board validates the list; absolute paths, parent-directory segments, empty lists and non-string entries are invalid. From launch until its PR merges or closes, a sweep blocks every new implementer, including urgent dispatch. Running work, reviews and repairs continue. Reviewed, green PRs touching a sweep path wait on automation as `Held behind sweep <id>`; unrelated PRs become ready as usual. The sweep's own readiness decision identifies it as a sweep, and its repairs run before other work, bypassing execution, backlog and area limits while retaining approval and provider-quota requirements.

After the sweep merges, each held PR receives one repair turn on its existing branch and PR to merge main and migrate its changes, with the sweep's saved task brief as context. Fleet then independently reviews and validates the new result before declaring it ready. Holds and migration handoffs survive restart. Closing the sweep without merging releases its holds without a migration turn.

### Schedule areas and dependencies

Use `areas` to name the code areas a task changes. Two areas overlap when they are equal or one is a `/`-prefix of the other: `work-fleet` and `work-fleet/host` block each other, while `work-fleet/host` and `work-fleet/cli` stay independent. The area `*` overlaps every area. Areas are labels, not filesystem paths. Fleet serializes overlapping claims; disjoint areas and tasks without areas can run concurrently within capacity and quota limits.

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

An overlapping task waits on automation, with a reason such as `waiting for area work-fleet/host held by task.foundation`. Areas are held through execution, review and validation, and are freed on completion or safe release. For a reviewed, green PR ready for a human merge, `areaMergeWaitMs` in Fleet policy or `fleet.config.json` defaults to `1800000` (30 minutes), counted from that readiness event. Once the wait expires, other tasks can use its areas while Fleet continues observing the PR for delivery. PostgreSQL preserves admission order across restarts; eligible overlapping tasks wait behind earlier queued work. Each scheduler pass retries waiting work but rewrites a waiting item only when its reason changes, and admission reads decode only the records that changed since the previous read.

The Git-backed host also predicts conflicts as reconciliation observes worker pushes. It uses `git merge-tree --write-tree --name-only` without checking out a branch, comparing the pushed head with current main and every other open PR it watches, including foreign reservations and worker PRs not yet adopted. `mergePrediction` records each conflict's two heads, PR URL (`main` for the base branch), file names and UTC observation time in typed PostgreSQL rows. A later-opened conflicting PR waits before review and merge readiness with an automation reason such as `waiting for predicted conflict with https://github.com/example/project/pull/7 (packages/work-fleet/src/storage/fleetMigrations.ts) to merge`. This hold survives restarts and remains independent of `areaMergeWaitMs`. When the earlier PR merges, Fleet continues the held worker on the same branch and PR once to fetch and merge main, resolve the conflicts, then receive fresh review and checks. Non-conflicting PRs proceed in parallel. Custom integrations can supply `FleetIntegrations.predict(pr, watchedPrs)`; a custom `MainSource` can supply `mergeConflicts(head, otherHeads)` to enable the host's prediction integration.

Reserve a PR Fleet did not launch with `work-fleet reserve-pr <url> --areas work-fleet --areas work-board/ui`. Fleet uses the matching Board task's areas when its `pr:` URL, `branch:` name or configured worker branch matches the PR; otherwise it uses the repeated `--areas` values. PR reservations hold those areas and an open-PR backlog slot until a scheduler pass observes the PR merged or closed, including after release or renewed preparation. Observation uses conditional GitHub requests with a cached ETag per PR; unchanged PRs return 304 without spending the GitHub rate limit. Failed GitHub reads retain the reservation. Reservations persist in PostgreSQL.

Fleet identifies work by its authored brief: the Markdown title and body, criteria, Board kind, deliverable kind and authored relationships. Bookkeeping fields such as `status`, `next_action` and `owner` do not change that revision. Editing them on working or reviewing items preserves the attempts; editing them on work with an open decision preserves the question and its recorded answers. Criteria or body edits refresh eligible queued and working items in place. Work waiting on a human decision still stops with Board context changed; an answer to the earlier decision cannot authorize execution against the changed brief. This revision rule applies to every status, including `done`: marking working items done leaves its original work and decision intact and resolvable. Done work can be queued again only after its authored brief changes; unchanged source or bookkeeping edits leave its accepted outcome intact. Saved whole-file revisions are compared through their exact saved source without rewriting records or publication receipts; records without that source still need renewed preparation when their revision differs. Approval remains a separate execution requirement.

A `depends_on` relationship is satisfied when the target's delivery PR merged into the base branch, whoever merged it and whatever Fleet's review covered. Fleet retains that merge evidence on released records and archived cycles. The target also qualifies through Board `status: done` when it has no active Fleet record: no record, done work and released work qualify. Later brief edits do not undo either form of satisfaction. A validated no-change outcome qualifies on its accepted brief revision; bookkeeping edits preserve that revision. Released work without a merged delivery does not satisfy a dependency unless it is done on the Board. Missing or ambiguous targets and criterion-specific references remain blocked. Dependency waits belong to automation and list every unmet dependency with its reason; status, wait timeout summaries and the generated Board view show the stored blocker.

Before launching queued work, Fleet rereads its Markdown source for the current Board status, including changes made during preparation assessment in the same scheduler pass. A `done`, `deferred` or `dropped` item moves to `released` with a durable `releaseReason`, clears its admission blocker and leaves the waiting list. Release survives restart.

### Pace new work by open PRs

Merge throughput, not launch throughput, limits a fleet. Every implementer that launches while earlier PRs wait to merge adds a PR that will conflict with, duplicate or go stale behind the others, and one flaky check can then pull many of them out of the merge queue at once. Fleet therefore applies back pressure: it launches new implementers freely while few of its PRs are open, launches fewer as they pile up, and always runs the work that moves existing PRs toward merge.

```json
{
  "concurrency": 20,
  "openPullRequests": { "ease": 6, "max": 15 }
}
```

This configuration allows full concurrency for new implementers up to 6 open Fleet PRs, then linearly fewer, and none at 15 or more. A new implementer launches only while running work plus work waiting to launch stays below the limit for the current count of open Fleet PRs. The limit is `concurrency` up to `ease` open PRs, falls linearly to `floor` at `max`, and stays at `floor` beyond it, rounding down. `floor` defaults to 0, `ease` may be 0, and `ease` must not exceed `max`. An open Fleet PR is the adopted change of a current Fleet cycle that has not completed or been released; PRs Fleet did not adopt, such as Renovate or human PRs, do not count, and the count comes from Fleet's own records rather than GitHub polling. A held item waits on automation, with a reason such as `waiting for open PRs to merge: 14 of 15`.

Only new implementer launches, from queued work, are throttled. Reviews, repairs and workers continuing after an answered question never wait on the curve. When slots are short, they also go first: an item in review or repair, or with queued answers, that waits for a slot holds it ahead of new implementers, which wait with a reason such as `waiting for 1 review or repair launches to go first (limit 1)`. A merged PR completes its item, lowers the count and frees new launches on the next pass. Without `openPullRequests`, that reservation still applies within `concurrency`.

### Launch urgent work now

Lower limits help merge throughput, but some small, independent work, such as a fix to Fleet itself, should start at once. `work-fleet dispatch --now <id>` launches the item over `concurrency`, the open-PR curve and `backlog`. A `fleet-priority: urgent` field in the item's frontmatter does the same whenever the scheduler reaches it. Area claims and `depends_on` dependencies still apply because they protect correctness rather than capacity; `--now --ignore-areas` also skips area claims. The request stays on the queued item until it launches, across later scheduler passes, and the daemon resumes a pending `--now` receipt after a restart. Fleet first asks for admission within the limits; only a launch the limits refused is recorded as over the limit, and `work-fleet status` shows that item as `launched over the limit` while it runs, so the operator sees why running work exceeds `concurrency`. The override covers the new implementer launch; its later reviews and repairs use the normal limits and go first as above.

```markdown
---
id: fleet.small-fix
kind: task
fleet: approved
fleet-priority: high
---
```

`fleet-priority` takes `urgent`, `high`, `normal` (the default) or `low`; Board treats the field as Fleet-owned, and any other value fails Fleet's Board read for that item. When slots are short, the scheduler admits queued work in priority order, and within a priority the existing admission order holds. Low work fills idle capacity after queued normal-or-higher work has had admission; an earlier queued low item does not reserve an area ahead of that work. A running low item keeps running when higher-priority work arrives. Low work still waits for held areas and unfinished `depends_on` dependencies.

### Run, dispatch and inspect

| Command | Behavior |
|---|---|
| `work-fleet serve <board-dir> [--port <port>]` | Starts the local HTTP RPC daemon, admits approved work, dispatches queued items and reconciles running work. |
| `work-fleet reserve-pr <url> [--areas <area> ...] [--port <port>]` | Reserves a foreign PR using matching Board areas or the supplied areas. |
| `work-fleet dispatch <work-id> [--now [--ignore-areas]] [--port <port>]` | Prepares and dispatches one approved item; explicit dispatch can re-approve an edited revision. `--now` launches over capacity limits; `--ignore-areas` also skips area claims. |
| `work-fleet status [--port <port>]` | Prints Active, owner-grouped waiting and Completed views from stored records, then the config the daemon applies. |
| `work-fleet status <work-id> --json [--port <port>]` | Filters to one item and prints the views as JSON. |
| `work-fleet close-finished-decisions [--dry-run] [--port <port>]` | Closes Fleet asks with applied answers and unanswered asks whose linked Board work is done, deferred or dropped; previews each closure with `--dry-run`. |
| `work-fleet release <work-id>... [--port <port>]` | Releases terminal waiting items and records closing responses on their Board decisions. |
| `work-fleet reassign <work-id> <decision-id> <owner> [--port <port>]` | Reassigns the exact current question to maintainer, orchestrator or automation. |
| `work-fleet wait <work-id> --timeout <seconds> [--port <port>]` | Subscribes to daemon snapshots until an outcome or timeout. |
| `work-fleet watch [work-ids...] [--follow] [--port <port>]` | Reports outcomes once, or keeps reporting transitions with `--follow`. |
| `work-fleet continue <work-id> [message] [--port <port>]` | Continues terminal work on its existing worker thread; reads stdin when the message is omitted. |
| `work-fleet answer <work-id> [text] [--release] [--port <port>]` | Answers the waiting worker question or Fleet decision; reads text from stdin when omitted, except with `--release`. |
| `work-fleet name-threads [--port <port>]` | Names existing Cloud threads from Fleet records and reports each rename or failure. |

Fleet closes an ask and marks its question `status: done` when it applies the answer. Reconciliation also closes open asks when their linked Board work is done, deferred or dropped, including work finished outside Fleet. The decision source records `state: closed` and the reason for closure. `close-finished-decisions` settles existing asks with applied-answer receipts as well as unanswered asks for finished work, and closes nothing on a second run. An unconsumed answer to an earlier question revision leaves its ask open.

Automatic reconciliation refreshes eligible edited briefs in place. Explicit dispatch can re-approve work waiting on a context decision; renewal still requires safe execution and result ownership. Keep `serve` active to reconcile worker progress. All commands except `serve` connect to its loopback port over RPC and open no PostgreSQL connection. `serve` writes its bound port to `<board-dir>/.fleet-port`. Clients read that file from `--board <board-dir>` (default `.work`); an explicit `--port` overrides discovery. On shutdown, the daemon removes the port file if it still holds that daemon's port. The running daemon owns its configuration; client `--config` does not change it. Without a daemon, clients other than `watch --follow` exit 1 with the address and a command to start it.

`answer` saves an answer request in PostgreSQL and prints `Answer recorded; applying in the background` before admission, Board publication or provider work. `answer --release` uses the same acknowledgement boundary. A recording failure exits with an error; a recorded request resumes after daemon restart. Each waiting request tracks its exact published decision and response before resolution. An earlier clarification or deferral receipt leaves the decision open and does not consume a later answer or release. `status` and `watch` keep its application on automation until the answer is applied. Application failures appear as `Answer failed` in status and can be retried with another answer. The daemon records the orchestrator response on Board and resolves what the item waits on in the background. Worker questions require nonempty text and continue on the same thread. Fleet decisions receive retry with the text as the overall response; for a reviewed, ready PR, nonempty text requests changes on the same branch and PR. Use `--release` to release terminal ownership instead. The command refreshes the managed decision and registers its current question before answering, including after a changed template was republished. If reconciliation replaces a decision with another of the same kind during the command, the answer applies to the current decision. A different kind or a move out of waiting records `Decision changed` with the current reason in status. Nonempty text sent during execution or repair is stored for the next worker turn, survives daemon restart and uses the same recorded acknowledgement before queueing in request order; release requests still require terminal waiting work. Items waiting on nothing return a typed error naming their stage. `status` prints each waiting question or reason, with `work-fleet answer <work-id>` in the maintainer and orchestrator lanes. Automation waits have no answer command. `src/host/daemonCommands.spec.ts`, `src/host/answerWorker.spec.ts`, `src/host/answerPublication.spec.ts`, `src/host/answerReplacement.spec.ts`, `src/host/answerQueue.spec.ts` and `src/host/approvedRework.spec.ts` prove these paths through daemon HTTP against PostgreSQL and synthetic Board directories. All answers and releases share one watched Board response index, so a request rereads only changed Board files. `src/host/answerDisconnect.spec.ts` proves acknowledgements within the timeout, the CLI confirmation, applying status and shared indexing while another connection holds the admission lock. `src/host/answerQueueAcknowledgement.spec.ts` proves working and repairing guidance confirms through the CLI while admission is held and queues multiple messages in order when admission frees. `src/host/answerAfterDeferral.spec.ts` proves answers and releases apply after reconciled clarification and deferral responses, and restart recovery matches the pending request’s exact response without applying it twice. `src/host/answerRequestRecovery.spec.ts` proves recorded requests survive shutdown before admission frees; `src/host/answerRecordingFailure.spec.ts` proves the CLI reports a failed database recording and permits a later valid request.

`wait` prints a summary and exits with these codes:

| Code | Meaning |
|---|---|
| `0` | Completed. |
| `1` | Error, including an unavailable daemon. |
| `2` | Waiting on the named owner. |
| `3` | Released. |
| `4` | The requested timeout expired. |

`--interval <seconds>` controls reconnect delay and defaults to 15. An item not yet recorded keeps waiting.

`watch` prints one line per item when that item is done, waiting or released, then exits 0 after every item has reported. Duplicate IDs report once; unknown IDs remain pending. With no IDs, it follows the active items found by its first successful read and exits when those items have reported. Existing done, waiting and released items are excluded from that initial active set.

`watch --follow` keeps running even when no work is active or every item has reported. With no IDs, it watches all items, including items launched later; explicit IDs restrict it to those items. Its first snapshot reports current waiting waits and records done or released history without printing it, then it prints one line when an item enters done, waiting or released. Human waits include the owner and reason; a reviewed PR ready for a human merge is a waiting wait on the maintainer. A new decision prints again, even if its reason is unchanged. An item that leaves waiting for repair and returns with the same reason reports again. Repeated snapshots of the same outcome do not print again. Reconnecting after a daemon restart preserves those states: unchanged history stays quiet, and an outcome that changed during the gap prints once. Stop the follower with Ctrl-C, or set an explicit `--timeout`.

`watch --follow` accepts unfamiliar decision codes, stages and extra fields from a newer daemon. It prints unfamiliar codes and stages as text; an entry whose display fields cannot decode prints its raw data without stopping other entries or later snapshots. Fatal watch errors exit 1 and print one cause line on stderr.

`wait` and `watch` each use one scoped RPC subscription. The daemon is the only store writer. Record and foreign-occupancy writes run through effect-sql `transact` and record table hints inside that transaction. The daemon shares one summary stream across followers. It subscribes to committed record hints before reading compact fields through its receipt connection, then reads again only when a record commit arrives; it does not poll PostgreSQL. New followers receive the last good snapshot; after the last follower leaves, the next subscription starts with a fresh read. PostgreSQL read failures retain the last good snapshot and retry every half second; 20 consecutive failed attempts end all current followers with a clear message and exit 1. A reconnect receives a snapshot of the original selected set, or all items for `watch --follow` without IDs; printed outcomes remain deduplicated. `watch --follow` writes an `ERROR` line to stderr on each failed connection attempt, including before its first snapshot, then retries at `--interval` without an attempt limit. Each retry rereads the port file, so a restarted daemon can change ports. `src/host/daemonDiscovery.spec.ts` proves repeated errors and recovery on a new port. Other wait and watch subscriptions retry connection loss up to 20 consecutive attempts before exit 1. `--timeout <seconds>` exits 4 and writes a timeout message to stderr. `src/host/watch.test.ts`, `src/host/daemonClients.spec.ts`, `src/host/snapshotStream.unit.test.ts` and `src/host/daemonFollow.spec.ts` cover output, HTTP restart resync, initial selection, PostgreSQL read recovery and failure bounds, the commit-subscription lifecycle and rollback silence. `src/host/daemonCommit.spec.ts` proves a daemon command reaches a CLI follower without periodic reads and a rolled-back store write sends neither a snapshot nor a refresh query. Client subprocess fixtures reject direct PostgreSQL connections, so the command tests fail if a client opens the store itself.

### Read the generated heading board

The CLI host writes `fleet/status.md` inside the Board folder. It derives Active, Waiting on maintainer, Waiting on orchestrator, Waiting on automation and Done columns from the same Fleet views, with one card per current unreleased item, retaining released items while a blocker remains. Done holds the same 50 most recent done items as `work-fleet status`, newest first, so the file stays small as finished work accumulates. Cards link to the task's Board identity and its adopted PR when available. The file contains execution stages and blockers, not worker prompts, session receipts or authored task status.

After the first scheduler cycle creates the file, select it as Work Board's home:

```sh
work-board ./notes --home fleet/status.md
```

The host refreshes the view on scheduler reads and after preparation, dispatch, reconciliation, reassignment and resolution. Work Board's existing file watcher refreshes an open page. Identical content leaves the file untouched. Publication failures are reported and retried on the next cycle without changing execution outcomes. The writer refuses authored content or symlinks at the generated destination. Board remains usable without Fleet; the generated file is an optional projection of SQL records. A composed headless runtime can opt into the same publication behavior by providing `statusLayer(boardRoot)` from `@shivaedev/work-fleet/host/statusLayer.ts` over its Fleet Layer and Node filesystem services.

### Identify who must act

Waiting records and views carry `attentionOwner`: `maintainer` for scope decisions or merging a reviewed PR, `orchestrator` for routine worker questions, result inspection and retry, and `automation` for unfinished dependencies, missing host integrations, occupied capacity or pending checks. Queued dependency waits stay in automation even when their stored owner is orchestrator. `FleetViews.waiting` contains separate `maintainer`, `orchestrator` and `automation` arrays. Items with blockers show the waiting stage and actor; terminal records retain their done or released stage while a Board acknowledgement is pending. `work-fleet status`, its JSON output and the generated Board views use these groups; wait and watch summaries name the owner while retaining their exit codes.

Reassign the exact current question with `fleet.reassign(workId, decisionId, attentionOwner)`, the native `Reassign` RPC command, or the CLI:

```sh
work-fleet reassign sample-task sample-decision maintainer --board ./notes
```

Retrying the original decision ID for the same committed reassignment recovers publication and acknowledgement without creating another question; a competing change reports a typed stale decision. Legacy waits keep the maintainer as the recipient of their published question, and reconciliation reads a recorded answer before changing an owner.

Reassignment publishes a new question for the assigned owner and acknowledges the old question as superseded, preserving both reviewed sources. Answers to the old question cannot continue the worker. Reconciliation retries publication and acknowledgement after failure or restart. Existing unowned decisions recover their original publication before publishing a replacement for the assigned owner. Owner labels do not grant runtime approval or delivery authority.

The CLI host also atomically publishes `fleet/health.json`, using Board's versioned `FleetHealth` schema from `@shivaedev/work-board/diagnostics/health.ts`. Running counts work with submitting, accepted or running attempts; queued counts queued work; waiting counts group every wait by maintainer, orchestrator and automation, including capacity and quota blockers and pending checks. The snapshot uses version 2. The snapshot carries the configured concurrency cap, publication time and freshness threshold, last completed scheduler pass and last observed structured provider capacity rejection. A host restart reloads the two last observations. Status-board and health publication failures do not change execution outcomes; the next publication retries. The daemon retains the same health observation in memory and serves it through the shared `daemon.diagnostics` HTTP RPC query, together with Codex rate-limit observations cached for one minute. The snapshot's `github` field carries the rate-limit headers of Fleet's own GitHub responses per resource, with their observation time and any active rate-limit wait, and the daemon serves these as its GitHub limits. Board's Diagnostics view reads this RPC query without Fleet or database dependencies; it does not read the health file. Health observations retain their publication time so a stalled runtime remains visibly stale.

A composed runtime enables health publication with `statusLayer(boardRoot, { concurrency, staleAfterMs })`, provides `healthLayer(boardRoot)` from `@shivaedev/work-fleet/host/healthLayer.ts`, and wraps its provider with `providerHealth` from `@shivaedev/work-fleet/host/providerHealth.ts`. Capacity comes only from structured `rateLimitExceeded`, `flexUnavailable` or `serverOverloaded` errors; unclassified rejection text is not treated as capacity. A repeatedly observed terminal turn does not refresh the same rejection's timestamp.

### Release waiting work

Every new Fleet decision records a stable `code` beside its human `reason`. Import the Schema literal union `DecisionCode` from `@shivaedev/work-fleet/DecisionCode.ts`; Platform integration errors carry a code through `withFailureContext(error, { code })` from `@shivaedev/work-fleet/engine/failureContext.ts`; uncoded errors receive a code from their Platform error tag. Session and Board failures retain their optional code fields. Release-only actions, report-correction retries, conflict repair and merge-ready reconciliation use codes. Conflict decisions use `pr-conflicting`. Decision fields remain optional for existing stored records; Fleet assigns codes when it publishes decisions. Rewording a release-only reason preserves its answer options.

The guided actions offer retry when Fleet can launch a new turn, review or delivery observation. Incompatible preparation, changed result identity, invalid adopted GitHub identity, oversized immutable reports, unconfigured stock-host no-change validation and report workers that published to GitHub offer only release, and the recommendation explains why trying again cannot help. Closing a published PR and deleting its branch retain publication evidence. Worker questions accept a recorded answer to continue the same thread, or a guided release answer to free terminal ownership. When Fleet acknowledges an answer or closes a published ask, it closes its attention request and sets the question's authored status to `done`; recorded answer history remains available on the question.

The published decision speaks to the maintainer in plain words. The tables in `src/engine/situations/` hold, for every decision code, what happened, what Fleet needs and recommends, and a label and outcome for each guided option; the option ids stay `retry` and `release`. Codes whose stored reason carries a failure message add it after the plain text as details. The stored `reason` and `recommendation` stay in CLI status for the orchestrator and do not appear on the card.

Codex RPC overload code `-32001` produces a `SessionFailure` with code `session-queue-full`; launch backoff uses that code and the rejected failure kind. Quota admission produces a platform `Forbidden` with `provider-quota-unavailable` in its failure context, which reconciliation keeps waiting on automation. Rewording either failure message leaves its retry or waiting behavior unchanged. Custom integrations supply these codes for the same behavior.

A guided release answer frees Fleet ownership even when the task content or location changed, or the task is now done, deferred, dropped or unapproved. Fleet still checks the exact decision source, question and response. Before release it reconciles unresolved receipts without submitting a turn and observes pending attempts; running, unreadable or mismatched execution evidence keeps ownership. When the provider reports `session-turn-missing`, or confirms the acknowledged turn is absent with no active thread progress, reconciliation releases a waiting item whose Board status is done, deferred or dropped. For an open task, `work-fleet answer --release <id>` releases it. Both paths retire the lost attempt, preserve its recorded receipt and mark its session unusable without replaying or resuming the turn. An uncoded ambiguous failure or unreadable provider evidence cannot authorize release by its wording. A retry answer resumes the prepared brief only while its authored identity still matches; changed criteria or body require renewed preparation. Repeated resolution and restart recover the same response and acknowledgement. After release without a merged delivery, the next admission pass prepares a fresh cycle if the task still has `fleet: approved` and is not closed. A held, unapproved or closed task stays released. The fresh cycle keeps the same item ID, preserves the released cycle and known PR reservations, and starts a new worker session. Explicit dispatch can also prepare a fresh cycle for approved, open work.

```sh
work-fleet release sample-one sample-two --board ./notes
```

The command records an explicit release response for each current waiting decision, including worker questions, then uses the same resolution path as a release answer. It supersedes an existing unambiguous response, refuses changed decision sources or competing responses, and can be repeated to recover a pending acknowledgement.

### Continue a worker with new instructions

Use `work-fleet continue <id> <message>` to send instructions to the existing worker thread of terminal work waiting on an owner or done work. Omit the message argument to read it from stdin. The current Board revision still needs approval; running or released work is refused. Work waiting on a human merge can continue on the same worker thread; its reviewed head stays in history and its PR ownership remains until the new result is adopted.

```sh
work-fleet continue work-id "Fix the failed checks on the existing PR"
printf '%s\n' "Check the remaining criterion" | work-fleet continue work-id
work-fleet wait work-id --board .work
```

When every execution slot is occupied, the command confirms a queued continuation and leaves the current cycle intact. The optional `FleetRecord.pendingContinuation` string stores the message across host restart. Further continuation instructions append to it, and releasing the item cancels the request. Reconciliation resumes the existing worker thread ahead of new queued work when capacity returns. `src/engine/queuedContinuation.spec.ts` proves these paths against real PostgreSQL through Fleet's story kit with a synthetic provider.

When a slot is available, the command persists the message and thread identity before submission and returns the item to Active. Keep `work-fleet serve` observing the Board: `wait` only reads PostgreSQL. A lost acknowledgement retains the attempt for reconciliation without replay. The prior cycle remains in history, including its decision and result; reconciliation supersedes the prior open decision. The new turn's output follows the first-launch adoption path, including report publication or PR review, validation and delivery, and replaces the prior current result. `Fleet.continue(workId, message)` and the native `Continue` command expose the same path to composed hosts.

A failed worker or repair attempt without a receipt is never adopted. Review refresh ignores that attempt and uses the preceding worker receipt for the retained result, including a prior cycle with the same Board revision and result identity. Retrying the failed follow-up starts a fresh independent review before validation and delivery.

Codex protocol rejections with no specific cause retry the same method and parameters, including the saved operation ID and thread, after 30 and 60 seconds. A third rejection reaches the existing failure handling and publishes a decision for a turn submission. Generic messages are “Something went wrong”, “Internal error”, “Internal server error” or an absent message, with an optional request ID. Invalid request, permission and quota messages do not use these retries or contention replay. Structured capacity failures keep their separate retry budget.

When an otherwise unclassified definite Codex turn rejection has an active turn in the provider's paginated turn state, Fleet classifies it with code `session-active-turn`. The retry rule uses that code, polls until the thread is idle, then submits the same saved operation, prompt and settings. Rewording the rejection leaves this behavior unchanged. An idle thread or unreadable state cannot authorize contention replay; distinct coded failures retain their own handling. Polling starts immediately, with delays doubling from two seconds to a maximum of thirty seconds. The attempt stays submitting with its execution ownership while waiting. The wait has a five-minute deadline across classification and busy rejections and permits at most three resubmissions. Reaching the wait deadline retains `session-active-turn`; exhausting resubmissions records `session-active-turn-exhausted`. Both mark the receiptless attempt failed, release execution capacity and queue a fresh thread with the saved instructions on the same branch and PR. The explicit “turn already active for thread” rejection uses that fallback even when the turn state appears idle. Fresh-thread retries share the five-attempt provider budget and persist their backoff across restart; exhaustion parks with the failure and attempt count. Credential and policy rejections cannot authorize contention replay even when the provider has an active turn.

### Answer a worker question

Cloud worker prompts instruct workers to stop for a decision with `FLEET_QUESTION: <question>` and include the context and choices needed to answer. Fleet recognizes this marker in a completed worker or repair turn, publishes the question through Board's response writer, and keeps the work in `waiting`, waiting on the orchestrator by default. Only `FLEET_MAINTAINER_QUESTION: <question>` escalates a worker question to the maintainer; mentioning the maintainer in ordinary question text does not escalate it. `work-fleet wait <id>` exits with code 2 while that question is open. Questions must use one of these explicit markers; Fleet does not infer questions from prose.

Record a nonempty answer through Board's response page or response API. Reconciliation continues the exact worker thread with the answer body under current approval, quota and capacity policy. The response receipt and continuation intent commit together before submission. Concurrent resolution, repeated resolution and restart do not submit the answer again; a lost acknowledgement reconciles the stored operation. If a crash occurs before submission and no authoritative receipt is available, Fleet retains the uncertain operation for human inspection. Clarification and deferral keep the question open. An answer cannot authorize edits to the authored brief; changed criteria or body require renewed preparation. Responses from the same author use the newest recorded response, ordered by recorded time and then response ID; different authors still need explicit supersession to resolve competing responses. Answer text supplies task input and does not grant delivery authority.

### Return a research report

Declare `delivers: report` on an approved task to request research. Report workers leave repository sources unchanged and return the whole report in the final message. They may create new uncommitted report attachments, but must never commit, push, create branches or open PRs. Omit the field to keep the PR workflow.

Cloud report workers fetch `origin/main` and check it out detached before setup and research. Their brief names the expected base commit from dispatch. End the final report with one `FLEET_HEAD: <full 40-character checked revision>` line from `git rev-parse HEAD`. Fleet stores it as the attempt's `reportRevision` and delivers only reports on the dispatched base or a verified descendant. Missing, older or divergent revisions create an orchestrator decision without publishing a report. Release and dispatch again to research current main. Composed hosts can provide `FleetIntegrations.isAncestor(base, revision)` to verify descendants; without it, reports must name the exact dispatched base.

```markdown
---
id: research.example
kind: task
fleet: approved
delivers: report
---
# Compare the available approaches
```

After a completed worker turn, Fleet publishes an ordinary `kind: report` item under `responses/fleet-report.<digest>.md`, with an `informs` relationship to the task. The result preserves the whole final output and records the exact session, turn and task revision in its worker receipt. The Markdown gateway uses Board's durable publisher; custom gateways implement `BoardGateway.report` with the same immutable, idempotent boundary. Before writing attachments or publishing, the CLI host saves the complete report text, retrieval warnings and attachment bytes in an immutable payload under `.fleet-reports/`, outside Board’s source index. Publication retries read that payload without recollecting files, preserving the same identity and bytes after restart or a lost acknowledgement even when Cloud retrieval changes.

The CLI host reconstructs report attachments from the completed turn’s paginated `thread/items/list` file changes. Workers must create every attachment with the file-edit/apply_patch tool under `/tmp/fleet-report/attachments/`, and use that tool for later edits. Adds contain UTF-8 file content; update hunks and deletes replay in item order to obtain each file’s final bytes. Files created or changed through shell commands are not exposed as file changes. Binary evidence must be attached as a base64 text file with its encoding stated. List every promised file on a separate final-report line, `FLEET_ATTACHMENT: <relative-path>`, so Fleet can record missing files. Files from other directories and earlier turns are excluded.

Retrieved files are saved in `responses/fleet-report.<digest>.attachments/` beside the result, with links in the report. Markdown attachments receive a `.attachment` suffix so Board does not index them as authored items. Reconstruction uses only new regular scratch files, with normalized relative paths, `lstat`, resolved-path containment and no-follow opens. Turn item downloads are limited to 16 MiB of cumulative UTF-8 JSON, attachment changes to 8 MiB, attachment count to 64 and aggregate attachment bytes to 32 MiB. Unsafe paths, missing adds, mismatched update hunks, unavailable retrieval and collection-limit failures publish report text with an Unavailable attachments section; they do not create a decision. Other retrievable files survive per-file reconstruction failures. Existing saved attachment bytes are never replaced.

After a terminal report turn, the host checks the configured GitHub remote for the exact `<branchPrefix><workId>` ref and all PRs opened from that branch, including closed PRs. A published branch or PR makes the work wait on the orchestrator with the reason `Report worker published to GitHub`; Fleet never deletes the branch. Unavailable remote evidence also blocks completion. The host rechecks before result publication on retry. Custom headless runtimes provide their report inspection and collection boundaries; the Markdown gateway alone publishes report text.

Local attachment validation and saved-payload failures park the completed attempt with the failed file path and cause. Report file errors stay tagged in the Effect channel until the Board or platform boundary maps them.

Successful publication records the report in the current Board read pass and completes the Fleet attempt without PR adoption, independent review, checks or delivery. Empty or whitespace-only output, or a complete report document over Board’s 256 KiB UTF-8 context limit, creates an orchestrator decision with a concrete reason instead of a result. The size check includes metadata, the worker receipt and attachment links, and runs before writing attachment files. Oversized reports leave no attachment folder. `wait` and the status views expose the same terminal states and result path. A retry after a publication failure republishes the existing completed attempt; a retry after empty output prepares another worker attempt. Oversized output offers only release because retry cannot shorten a completed report; prepare a worker to produce a shorter report after release. Scheduler passes do not repeat publication. These prompts direct worker behavior; runtime policy still owns execution authority.

### Cloud provider

The hosted Codex transport sends the configured environment and launch fields, then reads the final answer from a terminal turn. It authenticates from a Codex login file and can run a configured refresh command for an expired login. Failed refresh remains unavailable.

Cloud host configuration accepts `cloud.threadNamePrefix` (default `Fleet: `), `cloud.projectId` for an existing project, `cloud.archiveThreads` (default `true`), `cloud.requestTimeoutMs` (default 60 seconds) and `cloud.recoveryGraceMs` (default five seconds). Names use `<prefix><work-id>: <title>` from the prepared Board context's first heading. Titles have normalized whitespace and at most 80 Unicode characters, with an ellipsis when trimmed; a missing heading falls back to the work ID. Separate reviewer and repair threads add `(review)` or `(repair)` after the work ID. A repair that continues the worker thread retains its name. The Fleet session journal resolves names from persisted operation intents, so review integrations that start through the same session service receive reviewer names automatically.

Fleet persists the session acknowledgement before naming it. Launch naming retains the acknowledged work ID and loads only that record. Naming is best-effort: a rejected or failed request logs a warning with the session ID and cause, then Fleet starts the turn. Project assignment is sent with `thread/start`. `work-fleet name-threads` reads all stored Fleet records, including archived cycles and acknowledged sessions without turns, and renames threads whose current names differ from their Fleet names. It reports each rename to stdout and each read or rename failure to stderr, then continues other sessions. Shared threads are visited once and retain their original role and context. Repeating the command skips successful names and retries failures.

Restart the host with the same SQL namespace. An attempt intent commits before `thread/start`, its session acknowledgement commits before `turn/start`, and its turn acknowledgement commits before observation.

If the session ID is known, reconciliation searches all provider turn pages for the persisted operation ID and adopts the exact existing receipt. For an acknowledged Cloud thread with no turns, Fleet polls for `cloud.recoveryGraceMs` (default five seconds) to allow late acceptance to appear. If the thread remains empty, Fleet confirms its environment and starts the saved turn on that same thread, retaining the attempt and operation ID. Retry on a missing-turn decision uses the same recovery, including prepared prompts from older worker records. Recovery requires the current Board revision to remain approved. Missing or incomplete thread evidence, unrelated turns and duplicate operation matches stay blocked. If the thread acknowledgement itself was lost, the current protocol cannot locate that thread by operation ID: Fleet retains the attempt and reservation and raises a human blocker. Recovery never starts another thread for that attempt. Provider unavailability after session acknowledgement and a mismatched setting after thread creation also retain unresolved ownership.

Fleet cleans up worker, repair and reviewer threads after accepted completion or explicit safe release, and after renewal makes a prior conversation unusable for further repair. Terminal provider turns alone do not trigger cleanup: review, checks and human retry can still require the conversation. Cleanup deduplicates shared repair threads, includes acknowledged sessions without a turn, and persists completion markers. Archive failures leave the Fleet outcome accepted; scheduler reconciliation retries pending cleanup, including after restart or renewal, without repeating delivery. `cloud.archiveThreads: false` retains sessions and settles cleanup for that cycle. Transports without an archive capability also retain their sessions.

The adapter sends `thread/archive` and `thread/name/set`; grouping uses `thread/start.projectId`. The generated experimental app-server protocol also declares `thread/metadata/update.projectId` and `thread/list.projectId`, but Fleet does not call those methods.

Cloud worker instructions include startup waiting, the configured environment script, fetching current main to start the branch, repository checks and one pull request for human review. Workers watch CI after every push, repair failures on the same branch and report once CI is green on their exact head. The merge queue re-runs CI against latest main before merging. Workers merge main only when GitHub reports a conflict or their change needs something that landed there; a conflict-free branch behind main does not require a merge, fresh review or revalidation. Workers state the exact head's CI result before the final `FLEET_PR: <url>` or `FLEET_PR: none` line. The parser requires exactly one marker on the final line; missing or malformed reports yield no result. A report line is not proof of an adopted result or accepted delivery.

### Adopt a worker result

Select `"result": "github"` in the host's `fleet.config.json` to adopt a completed worker report through the authenticated `gh` CLI. The final two report lines are one `FLEET_HEAD: <sha>` line with the full head SHA and one `FLEET_PR: https://github.com/<owner>/<repo>/pull/<number>` line. Both markers tolerate surrounding whitespace and backticks around their values. Adoption records the GitHub PR number, exact head and all paginated changed paths, including both paths of a rename. The PR must be open or merged in the host repository and target its configured branch; a different reported head or base/path movement during observation fails with a typed platform `BadRequest` or `Conflict`. A PR closed without merging waits on the orchestrator.

A PR merged before adoption or during review still requires review when enabled and checks for its reported head before Fleet accepts the observed merge as delivery. Retrying a failed adoption resumes the completed worker receipt; retrying after review reuses that review session.

A final `FLEET_PR: none` claims no change at the reported `FLEET_HEAD`. Fleet retains that head and the report as evidence, and passes the result through review when enabled and required checks. Main movement does not invalidate the report; a changed task revision prevents adoption.

When GitHub adoption rejects a completed worker or repair report's format, Fleet requests one corrected report on the same worker thread, with the exact required ending. A second malformed report needs a human; answering `retry` starts a new correction turn. Reports whose PR head moved also receive a correction turn on the existing worker thread; a second stale report needs a human retry. Reports rejected for repository identity or PR state still need a human decision. Correction attempts retain launch settings, persist before submission and reconcile lost acknowledgements after restart.

### Independent review

With review enabled (the default), after adopting a result Fleet starts an independent reviewer through the same `SessionService`, provider and durable journal as workers. Reviewers receive the worker’s repository paragraph, the titles and bodies of implemented goals, the readable task and criteria, then the adopted PR, changed paths and exact-head check results. They do not receive the worker conversation. They use `FleetPolicy.launch` from host configuration; task launch overrides remain worker and repair settings. `FleetPolicy.reviewerGuidance` supplies repository-specific validation instructions, resolved by the command host from `worker.reviewerGuidance`. The Codex adapters request read-only execution with shell network access for read-only PR and exact-head CI inspection, and no escalation. Reviewers use existing exact-head repository objects, read-only repository tools or `gh pr view`, `gh pr diff` and `gh api --method GET`; network writes are prohibited. When the exact-head diff and check results are readable, the prompt requires a verdict. Passing required checks at that head are CI evidence even when job logs or artifacts are unavailable; reviewers record that limitation in their evidence.

The reviewer ends with `FLEET_REVIEW:` followed by JSON containing `head`, `verdict` (`approve` or `changes`), nonempty `evidence` and `findings`. Changes require concrete findings; approval requires an empty findings array. Fleet accepts this verdict only after the exact turn completes and records it with that revision and receipt. Accepted or running turns keep their execution slot without a verdict. A lost acknowledgement reconciles the existing operation. Failed turns with transient capacity failures use the bounded provider retry path; other failed turns produce a decision waiting on the orchestrator. In blocking mode, a malformed completed verdict gets one automatic follow-up on the same read-only reviewer thread requesting the required format. Fleet persists that attempt before submission and reconciles its receipt after restart; a second malformed reply produces a decision waiting on the orchestrator. Retry after that decision starts a fresh independent reviewer instead of parsing the same completed verdict again. When delivery observation finds a moved PR head after approval, Fleet verifies the current PR and its reserved paths, retains the prior result and review, clears stale checks and automatically starts a fresh independent reviewer before checks or delivery. The new result and review stage are persisted before reviewer launch so reconciliation can resume after restart. Retrying a stored moved-head decision observes the current PR and starts that review without re-parsing the old worker report, including when the prior review evidence is missing or stale.

Each completed review reply becomes a Board report document with an `informs` relationship to the task. The reviewer writes `## TL;DR` first, with a verdict and at most five one-line findings, followed by `## Details`, where findings give the claim, evidence, likelihood in real use, impact and suggested fix. Remote findings are omitted; a review with no findings says so in one line. Fleet keeps the reply as returned. A reply missing the requested shape is retained with a malformed note. Ready-to-merge decisions and the Board’s ready list show the TL;DR and link to the review document. Repository review rules remain in `worker.reviewerGuidance`.

### Required checks

The command host reads GitHub check runs and commit statuses through an authenticated `gh` CLI for the adopted PR's exact commit SHA, including all pages. It reads required status check contexts from `GET repos/{owner}/{repo}/rules/branches/{branch}` for the configured repository branch. Only required checks gate validation and send failures to repair; other checks remain in the evidence labelled non-required. Pending or absent required checks keep work in validation. With no required contexts configured, every observed check must succeed, be neutral or be skipped, and absent checks remain pending. A newer push does not replace the adopted head's evidence. If a check still fails after three consecutive completed check repairs, Fleet publishes an orchestrator decision naming it instead of launching another repair. The repair history survives restart; review repairs and changed failing check names do not count toward that check's limit. These observations do not establish merge authority.

### Human delivery

Fleet never submits a merge. Green PRs that passed blocking review, completed advisory review or skipped review under `review: false` wait on the maintainer as ready to merge. Reconciliation keeps observing the adopted PR through GitHub's REST API with the host's existing CLI authentication, accepts only a merge of the validated head and records the PR head and merge commit. A PR closed without merging waits on the orchestrator with that fact. A moved head goes through the currently configured review path and fresh checks automatically. A temporary observation failure preserves the current Board decision and ownership until GitHub evidence is available again.

Every GitHub read Fleet makes, for PR state, checks, rulesets, PR files and report publication, goes through one `GithubApi` seam that runs `gh api --include` against the REST API. The seam keeps the ETag of each URL and repeats reads as conditional requests, so an unchanged resource answers `304 Not Modified`, costs no rate limit and returns the cached body. It records the rate-limit headers of every response per resource with the time Fleet observed them. Every local tool shares one GitHub token, so Fleet keeps the last 20% of each resource's budget for agents and people. While the `core` budget stays above half, the scheduler runs at the configured interval; between half and 20% the pause stretches smoothly toward five minutes. Below 20% remaining Fleet makes no call to that resource until its reset, and affected work shows `GitHub paused below the 20% reserve until <time>`. A rate-limited response, primary or secondary, blocks further calls to that resource until the reset, the `retry-after` time or a backoff starting at one minute, and affected work shows `GitHub is rate-limited until <time>` without counting toward read-failure escalation. Fleet does not call `/rate_limit`.

A ready-to-merge decision answered with `retry` and a nonempty overall response sends those requested changes to the existing worker thread on the same branch and PR. Fleet clears approval and checks before repair, then independently reviews and checks the worker's next result. A retry with an empty or whitespace-only overall response retains the approved head and republishes merge readiness. GitHub's explicit `CONFLICTING` mergeability observation sends an approved PR to its worker to merge main once per observed main revision; durable revision receipts prevent repeated automatic repair across restart. A conflict that remains after that repair waits on the orchestrator.

Main advancing alone does not invalidate adoption, review or validation of an unchanged PR head: an approved, green, conflict-free head behind main stays ready through reconciliation and restart, then accepts its human merge without repeating review or validation.

## Compose the Effect core

Each scheduler pass shares a Board snapshot and identity index across admission, dispatch and reconciliation. Launch authorization calls `BoardGateway.get(workId, { fresh: true })` to reread the selected source and refresh its entry in that snapshot. Other item lookups retain their shared reads; the next pass reads changed, added and removed files again. Work revisions follow the authored brief read; approval is read separately, and decision publications retain their exact source revisions. Fleet's own publications enter the current snapshot after they are recorded; reconciliation that outlives the pass reads fresh sources.

Fleet excludes files with invalid metadata or unreadable sources from admission, records a Board problem with the file and diagnostic, and retries them on the next pass. An unrelated invalid file leaves running work undisturbed. A lookup of an invalid or missing work source still blocks that work; when metadata cannot supply its identity, the missing-identity diagnostic includes the Board file problems. The named problem reaches the execution status and the published decision, using the original approved context for publication.

Released work leaves the status waiting queues once its PR has merged and its Board task is done, superseded, deferred or dropped. If the PR or task is still open, the record keeps its current owner. Reconciliation retains the release reason and merge evidence without treating the merge as Fleet-reviewed delivery.

Provide `BoardGateway`, `FleetRepository`, `FleetPolicy`, `FleetIntegrations` and `SessionService` to `Fleet.layer`. The Markdown gateway reads Board context, and `postgresFleetRepository(namespace?)` supplies durable SQL attachments on a native `SqlClient`. Fleet stores scalar fields and scalar lists in typed PostgreSQL columns through effect-sql models. Nested objects use typed columns, and repeated records use ordered child tables, including archived cycles. Foreign occupancy uses a separate model repository. Versioned transaction writes reject stale updates and replace child rows atomically; the adapter retains Fleet’s one-based record versions. Engine record reads hold a shared transaction lock while loading their columns and children. Answer receipt and CLI status reads, and the daemon's status flush on shutdown through `Fleet.listSnapshot()`, use a repeatable-read snapshot so admission does not delay them; `src/host/answerRequestRecovery.spec.ts` proves the daemon stops while another connection holds admission, and `src/storage/recordSnapshot.spec.ts` proves locked and snapshot reads keep root fields and children at one committed version during concurrent writes. Startup migrates existing JSONB and text records, preserving nested values, record versions and admission order. `src/storage/typedMigration.spec.ts` reads every current and archived field back unchanged, distinguishes empty and absent structures, and proves rollback after migration and child-write failures. `src/storage/modelMigration.spec.ts` exercises the JSONB upgrade and requeueing; `src/host/modelMigration.spec.ts` covers daemon HTTP reads and writes after startup migration.

A session journal persists intents and acknowledged turns before further remote mutation, so recovery never launches a duplicate.

```ts
import { Fleet } from "@shivaedev/work-fleet/fleet.ts";
import { cycle } from "@shivaedev/work-fleet/engine/scheduler.ts";

const fleet = yield* Fleet;
yield* fleet.prepare({ workId, preparation, prompt, cwd });
yield* cycle;
```

Run this Effect program with your composed Fleet Layer. `FleetIntegrations` supplies source observations, actual result adoption, required checks and delivery observation. Its `checks` port also receives `"review"` as an optional third argument when Fleet reads a snapshot for the reviewer prompt; that observation does not replace required validation. Its `result` implementation must re-read current result ownership and head each time it is called. Set `FleetPolicy.review` to `false` to skip reviewer sessions in a composed runtime. Review when enabled and checks must name the exact adopted head; the reviewer must use a different session from the worker.

### Errors

Fleet commands and daemon streams declare `BadRequest`, `Conflict`, `Forbidden`, `NotFound` and `ServiceUnavailable` from `@shivaedev/platform/errors/taxonomy.ts`. Invalid input, stale state, denied actions, missing records and unavailable integrations use those tags respectively. The RPC boundary maps storage conflicts to `Conflict` and admission failures to `Forbidden`; clients retain declared tags and messages in the error channel. After a dispatch is accepted, its background failures are recorded in the dispatch receipt. Internal recovery metadata carries moved PR heads, conflicting main revisions and attention ownership without adding fields to platform errors.
