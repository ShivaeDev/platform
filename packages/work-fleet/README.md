# @shivaedev/work-fleet

Work Fleet carries approved Work Board tasks through coding agents to a reviewed, validated pull request that waits for a person to merge it. It keeps every attempt in PostgreSQL against the Board item, so a restart neither loses nor repeats work, and every wait names who must act.

## Keep approved work moving

Approving a task is the easy part. Someone still has to launch an agent, notice when it stalls or asks a question, read its pull request, send review findings back, wait for the required checks, catch conflicts with other open work and tell the maintainer when it is ready to merge. Across many tasks, that bookkeeping becomes the job.

Fleet does that bookkeeping. You approve an item in Board; Fleet admits it within your capacity limits, runs a worker, adopts its pull request, has a separate reviewer check the exact head, waits for the required checks and then puts the green pull request in your lane as ready to merge. Fleet never merges: it observes your merge and records the delivery. While work waits, the waiting views name who must act: the maintainer, the orchestrator or automation.

A task is an ordinary Board file:

```markdown
---

id: task.retry-budget
kind: task
status: ready
fleet: approved
areas: [work-fleet]
---

# Cap provider retries at five attempts
```

```sh
work-fleet up .work
```

`fleet: approved` lets Fleet run the task, and `areas` keeps it from running beside work that changes the same folder. `work-fleet up` starts Fleet and Board together for the Board folder `.work`.

## Using it

### How to think about it

Board owns the work and Fleet owns its execution. A Board item carries the identity, the authored brief, approval, relationships and the human answers. Fleet stores preparation, attempts and outcomes against that identity in PostgreSQL. Board stays useful without Fleet, and Fleet's generated views are projections of its SQL records.

One daemon serves each Board folder. It is the only writer of Fleet's records; every work command is a client that talks to it over local RPC. `work-fleet up` supervises that daemon and the Board server together.

Each item moves through a small set of stages, shared with Board:

| Concept               | Words                                                           |
| --------------------- | --------------------------------------------------------------- |
| Board document kind   | `goal`, `task`, `question`, `report`                            |
| Authored Board status | `draft`, `ready`, `done`, `deferred`, `dropped`                 |
| Fleet stage           | `queued`, `working`, `reviewing`, `waiting`, `done`, `released` |

The [Board vocabulary](https://github.com/ShivaeDev/platform/blob/main/packages/work-board/README.md#work-vocabulary) defines each authored state's meaning, approval, ownership, deliverables and question fields. Fleet keeps resumable execution steps in `record.step` beneath the shared `record.stage`. Stored records, status files, CLI and MCP projections use the same stages. Review, required-check validation and delivery observation all show as `reviewing`.

A finished worker turn is not finished work. A terminal worker turn is execution evidence; accepted completion also needs result adoption, review when enabled, required checks and an observed human merge of the validated head, or a validated no-change result. A provider receipt, a terminal turn, a passing review and an accepted delivery are separate facts, and Fleet records each one separately.

Fleet owns an item from launch until accepted delivery, a validated no-change result or an explicit safe release. Terminal execution frees the execution slot, but ownership stays. Running work retains ownership until normal completion or a confirmed safe release, and uncertain provider receipts retain ownership for reconciliation. When Fleet cannot tell what happened, it keeps the work and asks rather than starting a second worker.

Every wait names its owner and reason. The maintainer decides scope and merges; the orchestrator, the agent or person driving Fleet day to day, answers routine worker questions, inspects results and retries; automation covers what only time or other work can resolve. A predicted conflict hold names the PR to merge and the conflicting files.

Fleet identifies a task by its authored brief, not by its bookkeeping. Editing `status`, `next_action` or `owner` leaves the attempts alone; editing the title, body or criteria makes a new revision that Fleet either approves in place or stops on.

Merge throughput, not launch throughput, limits a fleet. Fleet limits running work with `concurrency`, undelivered results with `backlog`, overlapping changes with `areas`, and, when `openPullRequests` is set, new launches by the number of its open PRs.

The work has three parts: set up the host once per Board, write each task's brief, then follow and direct the work every day.

### 1. Once per Board: set up the host

#### Write the host configuration

Put `fleet.config.json` in the Board folder. For `up` or `serve`, `--config <file>` selects another configuration file. A Cloud host needs both `cloud` and `worker` settings:

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

Replace the placeholders with trusted host settings. Missing or invalid configuration fails.

`cloud.environmentId` identifies the Codex Cloud environment configuration, and `cloud.cwd` identifies its workspace. The Cloud transport confirms the returned environment before starting a turn. It rejects work prepared for a different workspace and rejects an echoed service tier that differs from the requested tier. `worker` supplies the branch prefix and environment script path used in the generated worker instructions.

The hosted Codex transport sends the configured environment and launch fields, then reads the final answer from a terminal turn. It authenticates from a Codex login file and can run a configured refresh command for an expired login; a failed refresh leaves the provider unavailable. `cloud.authFile` names the login file, which defaults to `auth.json` under `CODEX_HOME` or `~/.codex`, and `cloud.refreshCommand` (`{ "command": ..., "args": [...] }`) replaces the default `codex app-server --listen stdio://` refresh.

Cloud host configuration also accepts `cloud.threadNamePrefix` (default `Fleet: `), `cloud.projectId` for an existing project, `cloud.archiveThreads` (default `true`), `cloud.requestTimeoutMs` (default 60 seconds) and `cloud.recoveryGraceMs` (default five seconds). Thread names use `<prefix><work-id>: <title>` from the prepared Board context's first heading. Titles have normalized whitespace and at most 80 Unicode characters, with an ellipsis when trimmed; a missing heading falls back to the work ID. Separate reviewer and repair threads add `(review)` or `(repair)` after the work ID. A repair that continues the worker thread retains its name.

`"provider": "local"` runs workers through a local Codex app-server instead and needs `local.endpoint`, a loopback `ws://` address, with optional `local.requestTimeoutMs` (default 30 seconds).

`repository` names the Git remote and base branch Fleet observes, `{ "remote": "origin", "branch": "main" }` by default. `"result": "github"` adopts worker results from GitHub pull requests, as described under [After launch: adoption](#after-launch-adoption).

Each task can override `launch` per field, as described under [Approve a task](#approve-a-task).

#### Choose how results are reviewed

Set top-level `review` to `false` (off), `"advisory"` (review without sending findings back to the worker), or `true` (blocking, the default when omitted).
- Off sends delivered PRs straight to required check validation.
- Advisory runs the independent reviewer, records its verdict and continues to required check validation and the ready-to-merge decision even when it requests changes or returns a malformed reply.
- Blocking sends requested changes to repair.

A config edit applies to results that have not yet entered review; the choice for an adopted head survives daemon restart and later config edits. Reviews already started continue.

#### Add repository guidance

Set optional `worker.workerGuidance` to repository-specific worker instructions. It accepts inline text or `{ "file": "worker.md" }`; file paths resolve from the Board folder. An unreadable file fails host policy creation. Fleet includes the text in every worker prompt, including first turns, review and check repairs, manual continuations and report corrections. When unset, Fleet adds no worker guidance.

Set optional `worker.reviewerGuidance` to repository-specific review instructions, with the same inline or file forms and validation. The host includes the text in initial reviewer prompts and verdict follow-ups. Omitted guidance leaves the default prompt repository-independent.

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

#### Set capacity

The host defaults to `concurrency: 100`, `backlog: 100`, `namespace: "work_fleet"`, `quota: "codex"`, an empty `launch` and no `openPullRequests` curve. `concurrency` limits execution; `backlog` limits undelivered adopted changes; `openPullRequests` slows new implementer launches as Fleet's open PRs pile up. `intervalSeconds` sets the time between scheduler passes (15 by default).

The Codex quota policy uses ordinary-usage eligibility and caches observations for a minute; `quota: "unlimited"` admits without that provider limit. An unknown quota response fails rather than granting capacity.

`stallMinutes` (default 30) sets how long a running turn may stay silent before Fleet asks the orchestrator about it. `readRetryMs` (default `30000`) sets the first delay when a provider or integration read must back off. `areaMergeWaitMs` (default 30 minutes) sets how long a ready PR keeps its areas; see [Claim areas](#claim-areas). The [recovery guide](https://github.com/ShivaeDev/platform/blob/main/packages/work-fleet/docs/recovery.md) describes the stall and retry behavior in full.

#### Pace new work by open PRs

Every implementer that launches while earlier PRs wait to merge adds a PR that will conflict with, duplicate or go stale behind the others, and one flaky check can then pull many of them out of the merge queue at once. Fleet therefore applies back pressure: it launches new implementers freely while few of its PRs are open, launches fewer as they pile up, and always runs the work that moves existing PRs toward merge.

```json
{
	"concurrency": 20,
	"openPullRequests": { "ease": 6, "max": 15 }
}
```

This configuration allows full concurrency for new implementers up to 6 open Fleet PRs, then linearly fewer, and none at 15 or more. A new implementer launches only while running work plus work waiting to launch stays below the limit for the current count of open Fleet PRs. The limit is `concurrency` up to `ease` open PRs, falls linearly to `floor` at `max`, and stays at `floor` beyond it, rounding down. `floor` defaults to 0, `ease` may be 0, and `ease` must not exceed `max`.

An open Fleet PR is the adopted change of a current Fleet cycle that has not completed or been released. PRs Fleet did not adopt, such as Renovate or human PRs, do not count, and the count comes from Fleet's own records rather than GitHub polling. A held item waits on automation, with a reason such as `waiting for open PRs to merge: 14 of 15`.

Only new implementer launches, from queued work, are throttled. Reviews, repairs and workers continuing after an answered question never wait on the curve. When slots are short, they also go first: an item in review or repair, or with queued answers, that waits for a slot holds it ahead of new implementers, which wait with a reason such as `waiting for 1 review or repair launches to go first (limit 1)`. A merged PR completes its item, lowers the count and frees new launches on the next pass. Without `openPullRequests`, that reservation still applies within `concurrency`.

#### Prepare the database

`database.url` names the PostgreSQL database and is required: a host file without it is rejected at startup, so a host never connects to a database its file did not name. `namespace` prefixes Fleet's table names and migration ledger; restart the host with the same namespace so recovery finds its records.

The daemon's HTTP clients share one PostgreSQL admission pool, bounded by `database.maxConnections` (20 by default, at least 2), and one provider connection set. One admission-pool connection is reserved for the PostgreSQL change listener; the remaining connections serve queries and transactions. The daemon opens one additional receipt connection for answer recording, status and follower snapshots, so admission waiters cannot consume their database capacity.

Fleet migrates its tables at startup in the namespace ledger before acquiring application services. The migrations convert records written by earlier Fleet releases into the current typed tables, including stages of current and archived cycles, preserving nested values, record versions and admission order.

Board and Fleet refuse a Board written in an earlier Board vocabulary and name the affected file and field; run `work-board migrate <board dir>` once, as the [Board vocabulary](https://github.com/ShivaeDev/platform/blob/main/packages/work-board/README.md#work-vocabulary) describes. Migration preserves published decision revisions, registered questions, recorded answers and request receipts across the rewrite. Answered and settled asks retain their state; an edit to the question itself still invalidates its reviewed context.

#### Give Fleet GitHub access

Every GitHub read Fleet makes, for PR state, checks, rulesets, PR files and report publication, goes through one `GithubApi` seam that reads the REST API over HTTP through `@shivaedev/github`. At startup Fleet uses `GH_TOKEN`, then `GITHUB_TOKEN`, or reads the token once from `gh auth token` when neither environment variable is set.

The client keeps the ETag of each URL and repeats reads as conditional requests, so an unchanged resource answers `304 Not Modified`, costs no rate limit and returns the cached body. Fleet records the client's per-resource budget observations with the time it observed them. Fleet does not call `/rate_limit`.

Every local tool shares one GitHub token, so Fleet keeps the last 20% of each resource's budget for agents and people. While the `core` budget stays above half, the scheduler runs at the configured interval; between half and 20% the pause stretches smoothly toward five minutes. Below 20% remaining Fleet makes no call to that resource until its reset, and affected work shows `GitHub paused below the 20% reserve until <time>`.

A rate-limited response, primary or secondary, blocks further calls to that resource until the reset, the `retry-after` time or a backoff starting at one minute, and affected work shows `GitHub is rate-limited until <time>` without counting toward read-failure escalation.

#### Run Fleet and the Board

Run one foreground supervisor for each Board directory:

```sh
work-fleet up <board-dir> --port 3457 --board-port 4747 --home index.md --responses
```

`--port` (also `--fleet-port`) selects Fleet's port; `--board-port` selects Board's port. Board also receives `--home`, `--responses` and `--maintainer`. `--config` selects Fleet's host configuration. The command resolves the installed Fleet and Work Board packages from the repository that holds the Board directory and needs no shell restart loop. Keep `up` running: it is what reconciles worker progress.

The supervisor holds the canonical Board directory until shutdown. A second `up`, a hand-started `serve` or a hand-started Board command refuses with the owner's pid, ports and start time. A lease left by a dead process is reclaimed. A child that exits is restarted independently after a short backoff; a code change replaces the affected child after HTTP shutdown drains active requests. Code revisions are SHA-256 digests of Fleet, Board and their installed ShivaeDev package code; source execution watches source files, and published execution watches compiled code and Board assets.

```sh
work-fleet up <board-dir> --status
work-fleet up <board-dir> --status --json
work-fleet down <board-dir>
```

Status reports the supervisor and child pids, ports, uptime, restart counts and running code revisions. Both processes append to `<board-dir>/.work-up.log`, whose full path status prints. `down` or Ctrl-C stops both children and releases the directory. `work-fleet status --board <board-dir>` shows Fleet's work and configuration.

`work-fleet serve <board-dir>` runs only the daemon, binding to `127.0.0.1:3457`; `--port <port>` selects another port. The `work-board <board-dir>` command starts Board independently when the directory is not supervised. The daemon composes the Fleet service, the host and the scheduler once for its lifetime, writes its bound port to `<board-dir>/.fleet-port`, and on shutdown removes the port file if it still holds that daemon's port.

Work commands connect to the daemon's loopback port over RPC and open no PostgreSQL connection. They read the port file from `--board <board-dir>` (default `.work`); an explicit `--port` overrides discovery. The running daemon owns its configuration; client `--config` does not change it. Without a daemon, clients other than the JSON watch and `watch --follow` exit 1 with the address and a command to start it.

#### Edit the configuration while the daemon runs

The daemon watches its `fleet.config.json` (or the `--config` file) and applies a valid edit without a restart. `concurrency`, `backlog`, `intervalSeconds`, `quota`, `launch`, `openPullRequests`, `stallMinutes`, `areaMergeWaitMs`, `readRetryMs`, `review`, `worker.workerGuidance` and `worker.reviewerGuidance` take effect on the next scheduler pass or launch; an applied edit starts that pass at once. Running turns keep the launch settings they started with, and work that already holds capacity keeps running after `concurrency` is lowered.

Every other setting, such as `provider`, `database`, `namespace`, `cloud`, `local`, `repository`, `result`, `worker.branchPrefix` and `worker.sharedEnvironment`, keeps its running value: the daemon logs a warning and lists the changed paths as needing a restart. An edit saved by replacing the file keeps applying.

An edit that fails validation, is partly written, cannot be read, or names an unreadable guidance file keeps the last good config. The daemon logs a `HostConfigRejected` warning that names the failing field, and the next valid edit applies. A rejected edit never stops the daemon or drops tracked work.

#### Show Fleet on the Board

The CLI host writes `fleet/status.md` inside the Board folder. After the first scheduler cycle creates the file, select it as Work Board's home:

```sh
work-board ./notes --home fleet/status.md
```

The file derives Active, Waiting on maintainer, Waiting on orchestrator, Waiting on automation and Done columns from the same Fleet views, with one card per current unreleased item, retaining released items while a blocker remains. Done holds the same 50 most recent done items as `work-fleet status`, newest first, so the file stays small as finished work accumulates. Cards link to the task's Board identity and its adopted PR when available. The file contains execution stages and blockers, not worker prompts, session receipts or authored task status.

The host refreshes the view on scheduler reads and after preparation, dispatch, reconciliation, reassignment and resolution. Work Board's file watcher refreshes an open page. Identical content leaves the file untouched. Publication failures are reported and retried on the next cycle without changing execution outcomes. The writer refuses authored content or symlinks at the generated destination.

The CLI host also atomically publishes `fleet/health.json`, using Board's versioned `FleetHealth` schema from `@shivaedev/work-board/diagnostics/health.ts`; the snapshot uses version 2. Running counts work with submitting, accepted or running attempts; queued counts queued work; waiting counts group every wait by maintainer, orchestrator and automation, including capacity and quota blockers and pending checks. The snapshot carries the configured concurrency cap, publication time and freshness threshold, last completed scheduler pass and last observed structured provider capacity rejection. A host restart reloads the two last observations. The snapshot's `github` field carries the rate-limit headers of Fleet's own GitHub responses per resource, with their observation time and any active rate-limit wait. Health observations retain their publication time so a stalled runtime remains visibly stale. Status-board and health publication failures do not change execution outcomes; the next publication retries.

The daemon retains the same health observation in memory and serves it through the shared `daemon.diagnostics` HTTP RPC query, together with Codex rate-limit observations cached for one minute and its GitHub limits. Board's Diagnostics view reads this RPC query without Fleet or database dependencies; it does not read the health file.

### 2. Per task: write the brief

#### Approve a task

Set the exact `fleet: approved` value in the item's frontmatter. Missing approval or `fleet: held` does not approve it: `held` waits on a person and `manual` leaves the task to its owner. Approval stays separate from status, and Fleet runs only `fleet: approved` tasks. PR tasks default to `delivers: pr`; research tasks use `delivers: report`.

The optional `fleet-launch` object overrides host `launch` settings per field:

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

#### What the worker reads

Cloud worker prompts open with the repository README's first prose paragraph, then the titles and bodies of goals reached through `implements` relationships, then the task's title and body, areas and acceptance criteria as readable lists. They omit Board bookkeeping frontmatter. Repository worker guidance and Fleet's startup, evidence, question and final-report protocol follow that context; the [worker protocol](https://github.com/ShivaeDev/platform/blob/main/packages/work-fleet/docs/worker-protocol.md) describes the markers workers return.

Cloud workers cannot read local-only Board data. Cloud hosts compute the Board directory's repository-relative path only when that directory is inside the repository and git-ignored. Before launching, Fleet checks each criterion's text for that path. A match publishes an orchestrator decision naming the criteria and explaining that Cloud workers cannot read local-only Board data, without starting a session. Edit the criteria to use data available to the worker, then dispatch again. Local workers, Board directories outside the repository, directories that are not ignored, and paths mentioned only in the body do not trigger this guard.

#### Edit an approved brief

Fleet identifies work by its authored brief: the Markdown title and body, criteria, Board kind, deliverable kind and authored relationships. Bookkeeping fields such as `status`, `next_action` and `owner` do not change that revision, and neither does editing a linked goal, plan, report or decision, or an unrelated item. Editing bookkeeping on working or reviewing items preserves the attempts; editing it on work with an open decision preserves the question and its recorded answers.

Criteria or body edits refresh eligible queued and working items in place. When queued or working items have no open decision, Fleet approves an edited brief on the next pass if it still has `fleet: approved`, its owner is omitted or `codex`, and its status is not `done`, `deferred` or `dropped`. The worker keeps its session, turn and PR without a Board context changed decision. While the worker or repair turn runs, Fleet steers it with a summary of the changes followed by the full new brief; [brief steering](https://github.com/ShivaeDev/platform/blob/main/packages/work-fleet/docs/recovery.md#brief-steering) describes its delivery guarantees.

A changed brief that fails these conditions still stops for a human, and work waiting on a human decision stops with Board context changed. When that happens before the first launch, the decision card says the edit, such as an owner other than Codex, is one Fleet cannot accept by itself, and asks to undo the edit and try again or hand the task back; retry starts the work once the task matches what Fleet prepared.

`work-fleet dispatch <id>` can explicitly approve the current approved brief in place, even while its worker turn runs. Retry on the context decision approves the brief that decision was published against; an answer to a decision from before an edit cannot approve the new brief. Approval updates the stored context and prompt, closes the decision and preserves the current thread and PR. A retry answer closes it with one applied receipt for that answer; dispatch closes it as superseded. Fleet records at most one receipt per question. Renewal still requires safe execution and result ownership.

An answer cannot authorize edits to the authored brief; changed criteria or body require renewed preparation. Removing approval stops further execution. Changing a working item's `status` does not interrupt it.

The revision rule applies to every status, including `done`: marking working items done leaves its original work and decision intact and resolvable. Done work can be queued again only after its authored brief changes; unchanged source or bookkeeping edits leave its accepted outcome intact. Saved whole-file revisions are compared through their exact saved source without rewriting records or publication receipts; records without that source still need renewed preparation when their revision differs.

#### Close a task

Fleet treats `done`, `deferred` and `dropped` as closed. Closed tasks are never admitted. Dropped briefs stop their active work automatically; done or deferred briefs release queued or waiting work once its execution is confirmed terminal.

Before launching queued work, Fleet rereads its Markdown source for the current Board status, including changes made during preparation assessment in the same scheduler pass. A `done`, `deferred` or `dropped` item moves to `released` with a durable `releaseReason`, clears its admission blocker and leaves the waiting list. Release survives restart.

#### Claim areas

Use `areas` to name existing repository folders a task changes: a package folder under `packages/` or `examples/`, optionally followed by a folder inside its `src/`, or a top-level folder such as `script/release` or `.github`. Name the one to three home packages for the task’s one goal; use a subfolder only when the task stays inside one stable folder of a busy package. See the [Board’s task sizing guide](https://github.com/ShivaeDev/platform/blob/main/packages/work-board/docs/delivery/source-examples.md#size-a-task-and-pick-its-scheduling-areas). Board reports invalid areas with a nearest existing path suggestion, and Fleet refuses to dispatch them with the same diagnostic.

Two areas overlap when they are equal or one is a `/`-prefix of the other: `work-fleet` and `work-fleet/host` block each other, while `work-fleet/host` and `work-fleet/scheduling` stay independent. The area `*` overlaps every area. Fleet serializes overlapping claims; disjoint areas and tasks without areas can run concurrently within capacity and quota limits.

```yaml
---
id: task.follow-up
kind: task
fleet: approved
areas: [ work-fleet, work-board ]
relationships:
  - kind: depends_on
    target: task.foundation
---
# Add the follow-up behavior
```

An overlapping task waits on automation, with a reason such as `waiting for area work-fleet/host held by task.foundation`. Areas are held through execution, review and validation, and are freed on completion or safe release.

For a reviewed, green PR ready for a human merge, `areaMergeWaitMs` in Fleet policy or `fleet.config.json` defaults to `1800000` (30 minutes), counted from that readiness event. Once the wait expires, other tasks can use its areas while Fleet continues observing the PR for delivery.

PostgreSQL preserves admission order across restarts; eligible overlapping tasks wait behind earlier queued work. Each scheduler pass retries waiting work but rewrites a waiting item only when its reason changes, and admission reads decode only the records that changed since the previous read.

#### Hold work behind predicted conflicts

The Git-backed host also predicts conflicts as reconciliation observes worker pushes. It uses `git merge-tree --write-tree --name-only` without checking out a branch, comparing the pushed head with current main and every other open PR it watches, including foreign reservations and worker PRs not yet adopted. Conflicts between PRs include only files both branches changed from their merge base with current main; a stale branch's conflict with main stays on that PR. `mergePrediction` records each conflict's two heads, PR URL (`main` for the base branch), file names and UTC observation time in typed PostgreSQL rows.

A later-opened conflicting PR waits before review and merge readiness with an automation reason such as `waiting for https://github.com/example/project/pull/7 to merge: conflicting packages/work-fleet/src/storage/fleetMigrations.ts`. This hold survives restarts and remains independent of `areaMergeWaitMs`. When the earlier PR merges, Fleet continues the held worker on the same branch and PR once to fetch and merge main, resolve the conflicts, then receive fresh review and checks. Non-conflicting PRs proceed in parallel.

Work waiting for another PR or sweep to merge releases its areas immediately once execution has ended. Those areas stay released until a new worker or repair turn passes normal area admission, so a merge wait cannot hold an area needed to repair the PR it waits for.

Status and watch report observed cycles among area waits, predicted PR merge waits and sweep holds as `Stuck: wait cycle`, naming the work items and PRs involved; items blocked behind the cycle report the same reason. This includes cycles from custom prediction integrations.

#### Depend on other work

A `depends_on` relationship is satisfied when the target's delivery PR merged into the base branch, whoever merged it and whatever Fleet's review covered. Fleet retains that merge evidence on released records and archived cycles. The target also qualifies through Board `status: done` when it has no active Fleet record: no record, done work and released work qualify. Later brief edits do not undo either form of satisfaction.

A validated no-change outcome qualifies on its accepted brief revision; bookkeeping edits preserve that revision. Released work without a merged delivery does not satisfy a dependency unless it is done on the Board. Missing or ambiguous targets and criterion-specific references remain blocked. Dependency waits belong to automation and list every unmet dependency with its reason; status, wait timeout summaries and the generated Board view show the stored blocker.

#### Sweep the whole repository

A task that migrates a shared catalog, release-note format or repository-wide name can declare `sweep` as a nonempty list of repository-relative path globs:

```yaml
sweep: [ "packages/*/changes/**", "pnpm-workspace.yaml", "**/package.json" ]
```

Use `sweep: ['*']` to cover every path. Board validates the list; absolute paths, parent-directory segments, empty lists and non-string entries are invalid.

From launch until its PR merges or closes, a sweep blocks every new implementer, including urgent dispatch. Running work, reviews and repairs continue. Reviewed, green PRs touching a sweep path wait on automation as `Held behind sweep <id>`; unrelated PRs become ready as usual. The sweep's own readiness decision identifies it as a sweep, and its repairs run before other work, bypassing execution, backlog and area limits while retaining approval and provider-quota requirements.

After the sweep merges, each held PR receives one repair turn on its existing branch and PR to merge main and migrate its changes, with the sweep's saved task brief as context. Fleet then independently reviews and validates the new result before declaring it ready. Holds and migration handoffs survive restart. Closing the sweep without merging releases its holds without a migration turn.

#### Set priority and launch urgent work

```markdown
---

id: fleet.small-fix
kind: task
fleet: approved
fleet-priority: high
---
```

`fleet-priority` takes `urgent`, `high`, `normal` (the default) or `low`; Board treats the field as Fleet-owned, and any other value fails Fleet's Board read for that item. When slots are short, the scheduler admits queued work in priority order, and within a priority admission order holds. Low work fills idle capacity after queued normal-or-higher work has had admission; an earlier queued low item does not reserve an area ahead of that work. A running low item keeps running when higher-priority work arrives. Low work still waits for held areas and unfinished `depends_on` dependencies.

Some small, independent work, such as a fix to Fleet itself, should start at once despite the limits. `work-fleet dispatch --now <id>` launches the item over `concurrency`, the open-PR curve and `backlog`. A `fleet-priority: urgent` field does the same whenever the scheduler reaches it. Area claims and `depends_on` dependencies still apply because they protect correctness rather than capacity; `--now --ignore-areas` also skips area claims.

The request stays on the queued item until it launches, across later scheduler passes, and the daemon resumes a pending `--now` receipt after a restart. Fleet first asks for admission within the limits; only a launch the limits refused is recorded as over the limit, and `work-fleet status` shows that item as `launched over the limit` while it runs, so the operator sees why running work exceeds `concurrency`. The override covers the new implementer launch; its later reviews and repairs use the normal limits and go first as described under [Pace new work by open PRs](#pace-new-work-by-open-prs).

#### Request a research report

Declare `delivers: report` on an approved task to request research. Omit the field to keep the PR workflow.

```markdown
---

id: research.example
kind: task
fleet: approved
delivers: report
---

# Compare the available approaches
```

Report workers leave repository sources unchanged, research the dispatched main revision and return the whole report in their final message, with optional attachments. After a completed worker turn, Fleet publishes an ordinary `kind: report` item under `responses/fleet-report.<digest>.md`, with an `informs` relationship to the task, and saves attachments beside it.

Successful publication records the report in the current Board read pass and completes the Fleet attempt without PR adoption, independent review, checks or delivery. `wait` and the status views expose the same terminal states and result path. Scheduler passes do not repeat publication.

Empty output, a report over Board's 256 KiB context limit, a report on the wrong revision, or a report worker that published to GitHub creates an orchestrator decision instead of a result. A retry after a publication failure republishes the existing completed attempt; a retry after empty output prepares another worker attempt. Oversized output offers only release because retry cannot shorten a completed report; prepare a worker to produce a shorter report after release. The [worker protocol](https://github.com/ShivaeDev/platform/blob/main/packages/work-fleet/docs/worker-protocol.md#research-reports) covers revisions, attachments, limits and publication.

### 3. Every day: follow and direct the work

#### Dispatch an item now

The scheduler admits approved work on its own. `work-fleet dispatch <id>` asks for one item at once: it validates Board approval, saves a dispatch receipt in PostgreSQL and replies before refreshing remote main, preparing execution or contacting the provider. Pending duplicate requests share that receipt. Background processing records `completedAt` and either `status: completed` or `status: failed` with an `error`. Completion here means dispatch processing finished; the work's execution stage remains separate.

`status` includes pending and failed receipts in `FleetViews.dispatches`, and `watch` waits through pending preparation and reports a background refresh failure even when no execution record exists. When the scheduler recovers after a failed dispatch, watch preserves the current execution and terminal outcome instead of showing the old dispatch failure. Pending receipts resume when the daemon restarts; dispatching a failed request creates a new receipt.

Explicit dispatch can also prepare a fresh cycle for approved, open work after release; merged work requires a changed brief.

#### Read status

`work-fleet status` lists all active and waiting work with its stage, blocker, attention owner, links and PR, followed by at most 50 done items, newest first by completion time (falling back to update time, then work id). The overview reads operator fields without prompts, Board context, archived cycles or worker output. Overview decisions omit `publicationWork` and `published`; request `work-fleet status <id> --json` for the full record in `record`, including older done work. The filtered view sections remain available beside that record.

`work-fleet status` ends with the config the daemon applies now: when and from which file it was loaded, the provider and the reloadable settings with their defaults filled in, the paths waiting for a restart and the last rejected edit. `--json` carries the same view as `config`, with the database URL left out.

#### Know who must act

Waiting records and views carry `attentionOwner`:
- `maintainer` for scope decisions or merging a reviewed PR;
- `orchestrator` for routine worker questions, result inspection and retry;
- `automation` for unfinished dependencies, missing host integrations, occupied capacity or pending checks.

Queued dependency waits stay in automation even when their stored owner is orchestrator. `FleetViews.waiting` contains separate `maintainer`, `orchestrator` and `automation` arrays. Items with blockers show the waiting stage and actor; terminal records retain their done or released stage while a Board acknowledgement is pending. `work-fleet status`, its JSON output and the generated Board views use these groups; wait and watch summaries name the owner while retaining their exit codes. `status` prints each waiting question or reason, with `work-fleet answer <work-id>` in the maintainer and orchestrator lanes. Automation waits have no answer command.

#### After launch: adoption

With `"result": "github"`, Fleet adopts a completed worker report through the GitHub REST API. Adoption records the GitHub PR number, exact head and all paginated changed paths, including both paths of a rename. The PR must be open or merged in the host repository and target its configured branch; a different reported head or base/path movement during observation fails with a typed platform `BadRequest` or `Conflict`. A PR closed without merging waits on the orchestrator. Malformed or stale reports get one correction turn on the worker thread first; the [worker protocol](https://github.com/ShivaeDev/platform/blob/main/packages/work-fleet/docs/worker-protocol.md) describes the report format and corrections. A worker that reports no change at its head passes through review and required checks as a no-change result.

A PR merged before adoption or during review still requires review when enabled and checks for its reported head before Fleet accepts the observed merge as delivery. Retrying a failed adoption resumes the completed worker receipt; retrying after review reuses that review session.

#### After adoption: independent review

With review enabled, Fleet then starts an independent reviewer through the same `SessionService`, provider and durable journal as workers. Reviewers read the task, the adopted PR, its changed paths and exact-head check results, but not the worker conversation, and they cannot write. They use the host's `launch` settings; task launch overrides remain worker and repair settings. Accepted or running review turns keep their execution slot without a verdict. A lost acknowledgement reconciles the existing operation. Failed turns with transient capacity failures use the bounded provider retry path; other failed turns produce a decision waiting on the orchestrator. Each completed review becomes a Board report linked to the task, and ready-to-merge decisions show its TL;DR.

#### After review: required checks

Fleet reads GitHub check runs and commit statuses for the adopted PR's exact commit SHA through the GitHub REST API, including all pages. It combines required status check contexts from branch protection (`GET repos/{owner}/{repo}/branches/{branch}`) and active rulesets (`GET repos/{owner}/{repo}/rules/branches/{branch}`) for the configured repository branch. Only required checks gate validation and send failures to repair; other checks remain in the evidence labelled non-required. Pending or absent required checks keep work in validation. With no required contexts configured, checks do not gate validation. A newer push does not replace the adopted head's evidence. These observations do not establish merge authority.

If a check still fails after three consecutive completed check repairs, Fleet publishes an orchestrator decision naming it instead of launching another repair. The repair history survives restart; review repairs and changed failing check names do not count toward that check's limit.

#### Ready to merge: human delivery

Green PRs that passed blocking review, completed advisory review or skipped review under `review: false` wait on the maintainer as ready to merge. Fleet never submits a merge. Reconciliation keeps observing the adopted PR through GitHub's REST API with the host's configured GitHub credentials, accepts only a merge of the validated head and records the PR head and merge commit. A PR closed without merging waits on the orchestrator with that fact. A temporary observation failure preserves the current Board decision and ownership until GitHub evidence is available again.

A moved PR head after approval goes back through the currently configured review path and fresh checks automatically; [moved heads](https://github.com/ShivaeDev/platform/blob/main/packages/work-fleet/docs/recovery.md#moved-heads-and-failed-follow-ups) describes how.

Main advancing alone does not invalidate adoption, review or validation of an unchanged PR head: an approved, green, conflict-free head behind main stays ready through reconciliation and restart, then accepts its human merge without repeating review or validation. GitHub's explicit `CONFLICTING` mergeability observation sends an approved PR to its worker to merge main once per observed main revision; durable revision receipts prevent repeated automatic repair across restart. A conflict that remains after that repair waits on the orchestrator.

#### When a turn stalls or goes missing

A turn that stays silent for `stallMinutes` makes Fleet ask the orchestrator to keep waiting, retry in a fresh session or abandon it; Fleet never steers or interrupts a silent turn on its own. Lost turns, provider capacity rejections and unreadable state retain ownership and recover as the [recovery guide](https://github.com/ShivaeDev/platform/blob/main/packages/work-fleet/docs/recovery.md) describes.

#### Answer questions and decisions

Workers stop for a decision with an explicit `FLEET_QUESTION:` line. Fleet recognizes the marker in a completed worker or repair turn, publishes the question through Board's response writer, and keeps the work in `waiting`, waiting on the orchestrator by default; only `FLEET_MAINTAINER_QUESTION:` escalates to the maintainer, and Fleet does not infer questions from prose. `work-fleet wait <id>` exits with code 2 while that question is open.

Record a nonempty answer through Board's response page or response API, or with the CLI:

```sh
work-fleet answer sample-task "Keep the existing option name"
work-fleet answer --release sample-task
```

`answer` saves an answer request in PostgreSQL and prints `Answer recorded; applying in the background` before admission, Board publication or provider work; it reads the text from stdin when omitted, except with `--release`. `answer --release` uses the same acknowledgement boundary. A recording failure exits with an error; a recorded request resumes after daemon restart. The daemon records the orchestrator response on Board and resolves what the item waits on in the background. All answers and releases share one watched Board response index, so a request rereads only changed Board files.

Worker questions require nonempty text and continue the exact worker thread with the answer body under current approval, quota and capacity policy. For Fleet decisions, an answer whose trimmed text is exactly `release` selects release. Other text selects retry with the text as the overall response; for a reviewed, ready PR, nonempty text requests changes on the same branch and PR. Use `--release` to release terminal ownership instead.

A ready-to-merge decision answered with `retry` and a nonempty overall response sends those requested changes to the existing worker thread on the same branch and PR. Fleet clears approval and checks before repair, then independently reviews and checks the worker's next result. A retry with an empty or whitespace-only overall response retains the approved head and republishes merge readiness.

Nonempty text sent during execution or repair is stored for the next worker turn, survives daemon restart and uses the same recorded acknowledgement before queueing in request order; release requests still require terminal waiting work. Items waiting on nothing return a typed error naming their stage.

The answer applies to the exact decision it was recorded against; [answers and continuations](https://github.com/ShivaeDev/platform/blob/main/packages/work-fleet/docs/recovery.md#answers-and-continuations) describes how a decision that changes during the command is handled. An earlier clarification or deferral receipt leaves the decision open and does not consume a later answer or release; clarification and deferral keep a worker question open. `status` and `watch` keep the answer's application on automation until it is applied. Application failures appear as `Answer failed` with their cause in status, log the work ID and cause, and can be retried with another answer.

Responses from the same author use the newest recorded response, ordered by recorded time and then response ID; different authors still need explicit supersession to resolve competing responses. Answer text supplies task input and does not grant delivery authority.

Every new Fleet decision records a stable `code` beside its human `reason`. The guided actions offer retry when Fleet can launch a new turn, review or delivery observation. Incompatible preparation, changed result identity, invalid adopted GitHub identity, oversized immutable reports, unconfigured stock-host no-change validation and report workers that published to GitHub offer only release, and the recommendation explains why trying again cannot help. Closing a published PR and deleting its branch retain publication evidence. Rewording a release-only reason preserves its answer options.

The published decision speaks to the maintainer in plain words. The tables in `src/engine/situations/` hold, for every decision code, what happened, what Fleet needs and recommends, and a label and outcome for each guided option; the option ids stay `retry` and `release`. Codes whose stored reason carries a failure message add it after the plain text as details. The stored `reason` and `recommendation` stay in CLI status for the orchestrator and do not appear on the card.

When Fleet acknowledges an answer or closes a published ask, it closes its attention request and sets the question's authored status to `done`; recorded answer history remains available on the question.

#### Release waiting work

```sh
work-fleet release sample-one sample-two --board ./notes
```

Use `release` when work is waiting and its execution has ended. The command records an explicit release response for each current waiting decision, including worker questions, then uses the same resolution path as a release answer. For running work, it points to `work-fleet stop <id>`. It supersedes an existing unambiguous response, refuses changed decision sources or competing responses, and can be repeated to recover a pending acknowledgement.

A guided release answer frees Fleet ownership even when the task content or location changed, or the task is now done, deferred, dropped or unapproved. Fleet still checks the exact decision source, question and response, and it never releases work whose execution it cannot confirm has ended; [release with uncertain execution](https://github.com/ShivaeDev/platform/blob/main/packages/work-fleet/docs/recovery.md#release-with-uncertain-execution) describes those checks. A retry answer resumes the prepared brief only while its authored identity still matches.

After release without an adopted PR, the next admission pass prepares a fresh cycle if the task still has `fleet: approved` and is not closed. The fresh cycle keeps the same item ID, preserves the released cycle and known PR reservations, and starts a new worker session. A held, unapproved or closed task stays released.

A released PR remains under delivery observation without starting another worker. Once merged, it stays finished even if the brief still reads approved and ready; only explicit dispatch after a brief change can start a new cycle. Reconciliation retains the release reason and merge evidence. It accepts an exact reviewed and validated merge as the outcome; other human merges remain recorded without claiming Fleet review. Released work leaves the status waiting queues once its PR has merged and its Board task is done, superseded, deferred or dropped; if the PR or task is still open, the record keeps its current owner.

#### Stop active work

Use `work-fleet stop <id>` when work is no longer needed, including preparing, working, reviewing, repairing or waiting work. Stop interrupts the provider turn, waits for it to end, then frees the areas and execution slot and records a closing Board response that says the work was cancelled. The branch and any open PR stay intact; the command prints the PR URL and keeps the work released until explicit dispatch. Done, released and unknown work is refused with its state in the error.

Stopping a dispatch still preparing main cancels it before any worker starts; its dispatch status is `cancelled`. It stays stopped across daemon restarts until an explicit dispatch. The daemon stop response can be a released preparation summary before a Fleet record exists.

A brief changed to `status: dropped` stops its active work automatically. If the provider cannot confirm the interrupt and terminal execution within five seconds, Fleet records the turn as abandoned, frees ownership and ignores later output from that turn.

#### Continue a worker with new instructions

```sh
work-fleet continue work-id "Fix the failed checks on the existing PR"
printf '%s\n' "Check the remaining criterion" | work-fleet continue work-id
work-fleet wait work-id --board .work
```

`continue` sends instructions to the existing worker thread of terminal work waiting on an owner or done work; without the message argument it reads stdin. The current Board revision still needs approval; running, released or merged work is refused. Work waiting on a human merge can continue on the same worker thread; its reviewed head stays in history and its PR ownership remains until the new result is adopted.

When a slot is available, the command persists the message and thread identity before submission and returns the item to Active. Keep the daemon observing the Board: `wait` only reads Fleet's stored state. The prior cycle remains in history, including its decision and result; reconciliation supersedes the prior open decision. The new turn's output follows the first-launch adoption path, including report publication or PR review, validation and delivery, and replaces the prior current result.

When every execution slot is occupied, the command confirms a queued continuation and leaves the current cycle intact. The optional `FleetRecord.pendingContinuation` string stores the message across host restart. Further continuation instructions append to it, and releasing the item cancels the request. Reconciliation resumes the existing worker thread ahead of new queued work when capacity returns.

#### Reassign a question

```sh
work-fleet reassign sample-task sample-decision maintainer --board ./notes
```

Reassignment moves the exact current question to the maintainer, the orchestrator or automation. It publishes a new question for the assigned owner and acknowledges the old question as superseded, preserving both reviewed sources. Answers to the old question cannot continue the worker. A competing change reports a typed stale decision. Reconciliation retries publication and acknowledgement after failure or restart.

Waits recorded without an owner keep the maintainer as the recipient of their published question, and reconciliation reads a recorded answer before changing an owner. Existing unowned decisions recover their original publication before publishing a replacement for the assigned owner. Owner labels do not grant runtime approval or delivery authority.

#### Reserve a PR Fleet did not launch

```sh
work-fleet reserve-pr https://github.com/example/project/pull/9 --areas work-fleet --areas work-board/client
```

Fleet uses the matching Board task's areas when its `pr:` URL, `branch:` name or configured worker branch matches the PR; otherwise it uses the repeated `--areas` values. PR reservations hold those areas and an open-PR backlog slot until a scheduler pass observes the PR merged or closed, including after release or renewed preparation. Observation uses conditional GitHub requests with a cached ETag per PR; unchanged PRs return 304 without spending the GitHub rate limit. Failed GitHub reads retain the reservation. Reservations persist in PostgreSQL.

#### Close finished asks

Fleet closes an ask and marks its question `status: done` when it applies the answer. Reconciliation also closes open asks when their linked Board work is done, deferred or dropped, including work finished outside Fleet. The decision source records `state: closed` and the reason for closure.

`work-fleet close-finished-decisions` settles existing asks with applied-answer receipts as well as unanswered asks for finished work. It also clears failed-answer requests when Fleet work is done or released, or Board work is done, deferred or dropped, including when question registration failed. It records the closure reason on published questions and in the daemon log, and those requests stop appearing in status and watch reports. Failed answers for active work remain visible. `--dry-run` previews each closure, and a second run closes nothing. An unconsumed answer to an earlier question revision leaves its ask open unless a failed-answer request belongs to finished work.

#### Follow work as it moves

`work-fleet wait <id> --timeout <seconds>` subscribes to daemon snapshots until the item reaches an outcome, prints a summary and exits with a code that says which outcome; an item not yet recorded keeps waiting. `--interval <seconds>` controls the reconnect delay and defaults to 15.

`work-fleet watch` follows newly launched work and continuously prints one text event per line, with no blank or decorative lines, from the daemon's stored Fleet state. From the repository root it uses `.work`, like other work commands; `--board <dir>` selects another Board. PR queue and health events are included, and quiet heartbeats are disabled.

```sh
work-fleet watch
work-fleet watch --json
work-fleet watch --events released
```

Use `--json` for one JSON object per line, `--pr-events false` to disable PR monitoring, or `--heartbeat <seconds>` to emit quiet heartbeats. Stop with Ctrl-C or `--timeout <seconds>` (exit 4). `--events` accepts a comma-separated list of the following kinds; omitted, every kind except `released` is enabled. Unknown kinds fail at startup. With `--events` or `--json`, positional work IDs restrict the continuous stream to those items.

| Kind                                                          | Transition                                                                                                                          |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `waiting-on-orchestrator`                                     | Work needs orchestrator action, including a reviewed PR ready to merge.                                                             |
| `waiting-on-you`                                              | Work needs a maintainer decision.                                                                                                   |
| `done`                                                        | Fleet accepts completion.                                                                                                           |
| `released`                                                    | Fleet releases ownership.                                                                                                           |
| `stuck`                                                       | Working or reviewing work has no progress for `--stuck-after` seconds (default 1800). Further progress permits a later stuck event. |
| `dispatch-failed`                                             | Background dispatch fails; ordinary dependency and area waits are excluded.                                                         |
| `answer-failed`                                               | A recorded answer fails to apply.                                                                                                   |
| `board-answer`                                                | Another person answers a Board question.                                                                                            |
| `pr-merged`, `pr-closed`                                      | A watched PR merges or closes.                                                                                                      |
| `pr-dequeued`, `pr-stuck`, `pr-conflict`, `pr-auto-merge-off` | A watched PR needs queue or merge attention.                                                                                        |

Text events start with the event kind followed by named JSON values, so multiline details stay on one line. With `--json`, item events carry `kind` and `workId`, plus `reason` for waits and failures, and `pr` and `head` when Fleet has a result. A ready PR therefore includes its reason, PR URL and reviewed head SHA:

```json
{
	"kind": "waiting-on-orchestrator",
	"workId": "one",
	"pr": "https://github.com/example/repository/pull/7",
	"head": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
	"reason": "Reviewed PR is ready to merge"
}
```

`watch <ids...>` without event flags prints text outcomes once and exits when every selected item has reported; `watch --follow` keeps printing outcomes for all or selected items. The [watch guide](https://github.com/ShivaeDev/platform/blob/main/packages/work-fleet/docs/watching.md) covers heartbeats, reconnection, deduplication, Board answer and PR events, and how followers handle a newer daemon.

### Examples

#### A Cloud host with GitHub delivery

```json
{
	"provider": "cloud",
	"cloud": {
		"environmentId": "<environment-config-id>",
		"cwd": "<workspace-path>",
		"threadNamePrefix": "Fleet: "
	},
	"worker": {
		"branchPrefix": "fleet/",
		"sharedEnvironment": "<environment-script-path>",
		"workerGuidance": { "file": "worker.md" },
		"reviewerGuidance": { "file": "reviewer.md" }
	},
	"database": {
		"url": "<postgresql-url>",
		"maxConnections": 20
	},
	"repository": { "remote": "origin", "branch": "main" },
	"result": "github",
	"review": true,
	"concurrency": 20,
	"backlog": 40,
	"openPullRequests": { "ease": 6, "max": 15 },
	"stallMinutes": 30
}
```

This host runs workers in one Codex Cloud environment, adopts their GitHub PRs, reviews each result with a blocking reviewer, and launches new implementers freely until six of its PRs are open. `worker.md` and `reviewer.md` sit in the Board folder.

#### An orchestrator's day

```sh
work-fleet status
work-fleet dispatch --now fleet.small-fix
work-fleet answer task.retry-budget "Use the shared five-attempt budget"
work-fleet watch --json --events waiting-on-orchestrator,waiting-on-you,done
```

With `work-fleet up .work` running in another terminal, the orchestrator reads who must act, launches one urgent fix over the limits, answers a worker question and then follows only the transitions that need a person or report completion.

#### Read the daemon from an Effect program

```ts
import { Effect, Layer } from "effect";
import { FetchHttpClient } from "effect/http";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { DaemonContract } from "@shivaedev/work-fleet/host/daemonContract.ts";

const protocol = RpcClient.layerProtocolHttp({ url: "http://127.0.0.1:3457/_fleet/rpc" }).pipe(
	Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]),
);

export const waiting = Effect.scoped(
	Effect.gen(function* () {
		const client = yield* RpcClient.make(DaemonContract, { flatten: true });
		const status = yield* client("daemon.status", {});
		return status.waiting.maintainer;
	}),
).pipe(Effect.provide(protocol));
```

`waiting` reads the daemon's views and returns the items waiting on the maintainer.

### API and integration

#### CLI reference

- `work-fleet up <board-dir> [--port <port>] [--board-port <port>]`: Supervises Fleet and Board for one directory.
- `work-fleet up <board-dir> --status [--json]`: Shows supervised processes and the shared log path.
- `work-fleet down <board-dir>`: Stops both processes and releases the directory.
- `work-fleet serve <board-dir> [--port <port>]`: Starts the local HTTP RPC daemon, admits approved work, dispatches queued items and reconciles running work.
- `work-fleet reserve-pr <url> [--areas <area> ...] [--port <port>]`: Reserves a foreign PR using matching Board areas or the supplied areas.
- `work-fleet dispatch <work-id> [--now [--ignore-areas]] [--port <port>]`: Prepares and dispatches one approved item; explicit dispatch can re-approve an edited revision. `--now` launches over capacity limits; `--ignore-areas` also skips area claims.
- `work-fleet status [--port <port>]`: Prints Active, owner-grouped waiting and Completed views from stored records, then the config the daemon applies.
- `work-fleet status <work-id> --json [--port <port>]`: Filters to one item and prints the views as JSON.
- `work-fleet close-finished-decisions [--dry-run] [--port <port>]`: Closes Fleet asks with applied answers, unanswered asks for finished Board work, and stale failed answers for done, released, deferred or dropped work; previews each closure with `--dry-run`.
- `work-fleet release <work-id>... [--port <port>]`: Releases terminal waiting items and records closing responses on their Board decisions.
- `work-fleet reassign <work-id> <decision-id> <owner> [--port <port>]`: Reassigns the exact current question to maintainer, orchestrator or automation.
- `work-fleet wait <work-id> --timeout <seconds> [--port <port>]`: Subscribes to daemon snapshots until an outcome or timeout.
- `work-fleet watch --board <dir> [--pr-events] [--events <kinds>] [--stuck-after <seconds>]`: Streams Fleet transitions, Board answers, optional PR events and daemon health as JSON.
- `work-fleet watch <work-ids...> [--follow]`: Reports text outcomes once, or continuously with `--follow`.
- `work-fleet continue <work-id> [message] [--port <port>]`: Continues terminal work on its existing worker thread; reads stdin when the message is omitted.
- `work-fleet stop <work-id> [--port <port>]`: Interrupts running work and records its closing Board response while preserving the branch and PR.
- `work-fleet answer <work-id> [text] [--release] [--port <port>]`: Answers the waiting worker question or Fleet decision; reads text from stdin when omitted, except with `--release`.
- `work-fleet name-threads [--port <port>]`: Names existing Cloud threads from Fleet records and reports each rename or failure.

`wait` exits with these codes:

| Code | Meaning                                 |
| ---- | --------------------------------------- |
| `0`  | Completed.                              |
| `1`  | Error, including an unavailable daemon. |
| `2`  | Waiting on the named owner.             |
| `3`  | Released.                               |
| `4`  | The requested timeout expired.          |

`work-fleet name-threads` reads all stored Fleet records, including archived cycles and acknowledged sessions without turns, and renames threads whose current names differ from their Fleet names. It reports each rename to stdout and each read or rename failure to stderr, then continues other sessions. Shared threads are visited once and retain their original role and context. Repeating the command skips successful names and retries failures.

#### Daemon RPC

Native Effect HTTP RPC uses NDJSON at `/_fleet/rpc`. Import `DaemonContract` from `@shivaedev/work-fleet/host/daemonContract.ts` and provide `RpcClient.layerProtocolHttp` with `RpcSerialization.layerNdjson` and an HTTP client, as in [the example](#read-the-daemon-from-an-effect-program).

The contract exposes Fleet's prepare, dispatch, continue, reconcile, resolve, reassign, get and views operations, plus `daemon.dispatch` for explicit Board dispatch, `daemon.dispatch-status` for its receipt, `daemon.status` for filtered views, the `daemon.follow` snapshot stream and `daemon.watch` snapshots with instance identity and heartbeats for the JSON watcher. `daemon.dispatch` returns a `DispatchRequest` with `id`, `workId`, `acceptedAt` and `status`; `daemon.dispatch-status` reads the latest receipt for an item, including a failed receipt after the scheduler recovers. `daemon.status` with `workId` returns the full record. The native `Reassign` and `Continue` commands expose the same paths as the CLI.

Platform's `RequestTracing` supplies a request id for each call, preserving valid `x-request-id` values. Only loopback Host values and missing or same-origin transport Origin headers are accepted; requests must use `application/ndjson`.

#### Run the daemon in your own host

```ts
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Effect from "effect/Effect";
import { loadHost } from "@shivaedev/work-fleet/host/configFile.ts";
import { serveFleet } from "@shivaedev/work-fleet/host/daemon.ts";

const program = Effect.gen(function* () {
	const host = yield* loadHost(".work");
	yield* serveFleet(host);
});

NodeRuntime.runMain(program.pipe(Effect.provide(NodeServices.layer)));
```

`loadHost(boardDir, configFile?)` from `@shivaedev/work-fleet/host/configFile.ts` reads and validates the host configuration. Compose `daemonLayer(host, parts, port)` in a scoped host, or launch it with `serveFleet(host, parts, port)`, both from `@shivaedev/work-fleet/host/daemon.ts`. The daemon uses Platform’s `appHost` with the loopback policy and `/_fleet/rpc` as its RPC path. Its shared `appDatabase` layer completes Fleet migrations in the namespace ledger before acquiring application services. The listener starts before scheduling.

The daemon's Board answer stream reads only registered questions whose current source request is open and still matches the reviewed revision. Settled questions and their answer history leave recurring Board reads for the Board's on-demand archive.

When PostgreSQL is still starting, the daemon logs its wait and retries `database.url` with exponential backoff from one to ten seconds. It waits up to five minutes before failing with a typed `HostFailure` naming that setting. Once PostgreSQL is ready, startup continues in the same daemon without a supervisor restart.

A composed headless runtime can opt into status publication by providing `statusLayer(boardRoot)` from `@shivaedev/work-fleet/host/statusLayer.ts` over its Fleet Layer and Node filesystem services. It enables health publication with `statusLayer(boardRoot, { concurrency, staleAfterMs })`, provides `healthLayer(boardRoot)` from `@shivaedev/work-fleet/host/healthLayer.ts`, and wraps its provider with `providerHealth` from `@shivaedev/work-fleet/host/providerHealth.ts`. Capacity comes only from structured `rateLimitExceeded`, `flexUnavailable` or `serverOverloaded` errors; unclassified rejection text is not treated as capacity. A repeatedly observed terminal turn does not refresh the same rejection's timestamp.

#### Compose the Effect core

```ts
import * as Effect from "effect/Effect";
import { cycle } from "@shivaedev/work-fleet/engine/scheduler.ts";
import { Fleet, type PrepareWork } from "@shivaedev/work-fleet/fleet.ts";

export function launch(work: PrepareWork) {
	return Effect.gen(function* () {
		const fleet = yield* Fleet;
		yield* fleet.prepare(work);
		yield* cycle;
	});
}
```

`launch` prepares one item and runs one scheduler pass. Run it with your composed Fleet Layer: provide `BoardGateway`, `FleetRepository`, `FleetPolicy`, `FleetIntegrations` and `SessionService` to `Fleet.layer`. Composed hosts call the same paths as the CLI through `Fleet`, for example `fleet.reassign(workId, decisionId, attentionOwner)` and `fleet.continue(workId, message)`.
- `BoardGateway` reads Board context and publishes decisions, reports and responses. `markdownBoard(root)` from `@shivaedev/work-fleet/board/markdown.ts` is the Markdown gateway. Custom gateways implement `report` with the same immutable, idempotent boundary as Board's durable publisher, and `respond` to record closing responses for `stop`.
- `FleetRepository` stores records. `postgresFleetRepository(namespace?)` from `@shivaedev/work-fleet/engine/repository.ts` supplies durable SQL attachments on a native `SqlClient`.
- `FleetPolicy` carries capacity, launch settings, quota and review settings. Set `FleetPolicy.review` to `false` to skip reviewer sessions; `FleetPolicy.launch` supplies reviewer launch settings and `FleetPolicy.reviewerGuidance` repository-specific validation instructions, which the command host resolves from `worker.reviewerGuidance`.
- `FleetIntegrations` supplies source observations, actual result adoption, required checks and delivery observation. Its `result` implementation must re-read current result ownership and head each time it is called. Its `checks` port also receives `"review"` as an optional third argument when Fleet reads a snapshot for the reviewer prompt; that observation does not replace required validation. Optional `publication(work)` supplies branch and PR evidence for lost-turn recovery, `isAncestor(base, revision)` verifies report revisions, and `predict(pr, watchedPrs)` predicts merge conflicts; a custom `MainSource` can supply `mergeConflicts(head, otherHeads)` to enable the host's prediction integration.
- `SessionService` runs one provider conversation and its turns through a `SessionTransport` and a durable session journal, independent of scheduling, dependencies and merge authority.

Review when enabled and checks must name the exact adopted head; the reviewer must use a different session from the worker.

Each scheduler pass shares a Board snapshot and identity index across admission, dispatch and reconciliation. Launch authorization calls `BoardGateway.get(workId, { fresh: true })` to reread the selected source and refresh its entry in that snapshot. Other item lookups retain their shared reads; the next pass reads changed, added and removed files again. Work revisions follow the authored brief read; approval is read separately, and decision publications retain their exact source revisions. Fleet's own publications enter the current snapshot after they are recorded; reconciliation that outlives the pass reads fresh sources.

Fleet excludes files with invalid metadata or unreadable sources from admission, records a Board problem with the file and diagnostic, and retries them on the next pass. An unrelated invalid file leaves running work undisturbed. A lookup of an invalid or missing work source still blocks that work; when metadata cannot supply its identity, the missing-identity diagnostic includes the Board file problems. The named problem reaches the execution status and the published decision, using the original approved context for publication.

#### Decision codes

Import the Schema literal union `DecisionCode` from `@shivaedev/work-fleet/DecisionCode.ts`. Platform integration errors carry a code through `withFailureContext(error, { code })` from `@shivaedev/work-fleet/engine/failureContext.ts`; uncoded errors receive a code from their Platform error tag. Session and Board failures retain their optional code fields. Release-only actions, report-correction retries, conflict repair and merge-ready reconciliation use codes. Conflict decisions use `pr-conflicting`. Stored decisions may lack a code; Fleet assigns codes when it publishes decisions. The [recovery guide](https://github.com/ShivaeDev/platform/blob/main/packages/work-fleet/docs/recovery.md#provider-capacity) lists the session codes that drive retries.

#### Errors

Fleet commands and daemon streams declare `BadRequest`, `Conflict`, `Forbidden`, `NotFound` and `ServiceUnavailable` from `@shivaedev/errors/taxonomy.ts`. Invalid input, stale state, denied actions, missing records and unavailable integrations use those tags respectively. The RPC boundary maps storage conflicts to `Conflict` and admission failures to `Forbidden`; clients retain declared tags and messages in the error channel. After a dispatch is accepted, its background failures are recorded in the dispatch receipt. Internal recovery metadata carries moved PR heads, conflicting main revisions and attention ownership without adding fields to the shared errors.

### Install, setup and limits

Install Fleet in the repository that holds the Board folder, with its Effect peers:

```sh
pnpm add --save-dev @shivaedev/work-fleet effect @effect/platform-node @effect/platform-node-shared
```

The package provides the `work-fleet` command and brings Work Board with it. Node 24 or newer is required. The peer ranges in the [manifest](https://github.com/ShivaeDev/platform/blob/main/packages/work-fleet/package.json) decide which Effect versions resolve. Modules are imported by path, such as `@shivaedev/work-fleet/fleet.ts`.

A running host needs:
- PostgreSQL, reachable at `database.url`.
- `git` on the path, with `merge-tree --write-tree`. The Board folder sits inside a Git checkout of the repository the workers change, and Fleet fetches `repository.remote` and `repository.branch` there.
- For `"provider": "cloud"`, a Codex Cloud environment and a Codex login file; the Codex CLI refreshes an expired login. For `"provider": "local"`, a Codex app-server on a loopback WebSocket.
- For GitHub reads, a token in `GH_TOKEN` or `GITHUB_TOKEN`, or a signed-in `gh`.

Fleet works with Codex as its only provider and GitHub as its only result and delivery integration; other providers or forges need a composed host with their own `SessionTransport` and `FleetIntegrations`. Fleet never submits a merge, so a person or a merge queue must merge every PR. It never bypasses repository protections, and worker or answer text cannot grant execution or delivery authority.

Fleet's tests run against real PostgreSQL with synthetic Codex, Cloud and GitHub servers; they do not prove live hosted Cloud execution, review, GitHub adoption or delivery. A local Codex transport proves nothing about hosted Cloud.
