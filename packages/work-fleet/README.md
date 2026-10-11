# @shivaedev/work-fleet

Work Fleet launches approved Work Board items and keeps execution receipts in PostgreSQL. Use its command to schedule workers and inspect progress, or compose its Effect services with your own result, validation and delivery integrations.

## Keep approved work moving

Approve an item in Board, then let Fleet admit it and observe its worker. The host tests exercise this loop without launching an external worker.

```sh
work-fleet run <board-dir>
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

The host defaults to `concurrency: 100`, `backlog: 100`, `namespace: "work_fleet"`, `quota: "codex"` and an empty `launch`. `concurrency` limits execution; `backlog` limits undelivered adopted changes. The Codex quota policy uses ordinary-usage eligibility and caches observations for a minute; `quota: "unlimited"` admits without that provider limit. An unknown quota response fails rather than granting capacity.

Missing or invalid configuration fails. Configuration and Cloud request tests are in `src/host/config.test.ts`, `src/host/quota.test.ts` and `src/providers/codexCloud.test.ts`; they prove parsing and synthetic provider behavior, not live Cloud computation.

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

### Run, dispatch and inspect

| Command | Behavior |
|---|---|
| `work-fleet run <board-dir>` | Admits approved work, dispatches prepared items and reconciles running work. |
| `work-fleet dispatch <work-id> --board <board-dir>` | Prepares and dispatches one approved item; explicit dispatch can re-approve an edited revision. |
| `work-fleet status --board <board-dir>` | Prints Active, Needs human and Completed views from stored records. |
| `work-fleet status <work-id> --board <board-dir> --json` | Filters to one item and prints the views as JSON. |
| `work-fleet wait <work-id> --board <board-dir> --timeout <seconds>` | Polls stored state until an outcome or timeout. |
| `work-fleet watch [work-ids...] --board <board-dir>` | Follows several items in one process and reports each outcome once. |
| `work-fleet name-threads --board <board-dir>` | Names existing Cloud threads from Fleet records and reports each rename or failure. |

Automatic admission does not re-approve an edited item that already has a record. Explicit dispatch reads the current approved revision; renewal still requires safe execution and result ownership. Keep `run` active to reconcile worker progress; `wait` only observes PostgreSQL. The host loop and approval behavior are exercised against PostgreSQL in `src/host/commands.test.ts`; `src/host/statusProcess.spec.ts` exercises status output and flags.

`wait` prints a summary and exits with these codes:

| Code | Meaning |
|---|---|
| `0` | Completed. |
| `1` | Error, including missing configuration. |
| `2` | Needs human. |
| `3` | Released. |
| `4` | The requested timeout expired. |

`--interval <seconds>` controls the time between reads. An item not yet recorded keeps waiting. `src/host/wait.test.ts` exercises the actual process, terminal summaries, timeout, missing configuration and delayed creation against PostgreSQL.

`watch` prints one line per item when that item is completed, needs-human or released, then exits 0 after every item has reported. Duplicate IDs report once; unknown IDs remain pending. With no IDs, it follows the active items found by its first successful read and exits when those items have reported. Existing completed, needs-human and released items are excluded from that initial active set. Each poll uses one PostgreSQL query for summary fields, without loading execution history or the Fleet runtime. `--interval <seconds>` defaults to 15; `--timeout <seconds>` exits 4 and writes a timeout message to stderr. Read failures retry up to 20 consecutive polls before exit 1. `src/host/watch.test.ts` and `src/host/readWaitStates.test.ts` exercise these rules against PostgreSQL.

### Read the generated heading board

The CLI host writes `fleet/status.md` inside the Board folder. It derives Active, Needs human and Done columns from the same Fleet views, with one card per current unreleased item. Cards link to the task's Board identity and its adopted PR when available. The file contains execution stages and blockers, not worker prompts, session receipts or authored task status.

After the first scheduler cycle creates the file, select it as Work Board's home:

```sh
work-board ./notes --home fleet/status.md
```

The host refreshes the view on scheduler reads and after preparation, dispatch, reconciliation and resolution. Work Board's existing file watcher refreshes an open page. Identical content leaves the file untouched. Publication failures are reported and retried on the next cycle without changing execution outcomes. The writer refuses authored content or symlinks at the generated destination. Board remains usable without Fleet; the generated file is an optional projection of SQL records. A composed headless runtime can opt into the same publication behavior by providing `statusLayer(boardRoot)` from `@shivaedev/work-fleet/host/statusLayer.ts` over its Fleet Layer and Node filesystem services. `src/board/statusMarkdown.test.ts`, `src/board/writeStatus.test.ts` and `src/host/statusLayer.test.ts` cover rendering, file boundaries and publication retry.

The CLI host also atomically publishes `fleet/health.json`, using Board's versioned `FleetHealth` schema from `@shivaedev/work-board/diagnostics/health.ts`. Running counts work with submitting, accepted or running attempts; queued counts prepared work; needs-human counts that explicit stage. The snapshot carries the configured concurrency cap, publication time and freshness threshold, last completed scheduler pass and last observed structured provider capacity rejection. A host restart reloads the two last observations. Status-board and health publication failures do not change execution outcomes; the next publication retries. Board's Diagnostics view reads the optional file without Fleet or database dependencies.

A composed runtime enables health publication with `statusLayer(boardRoot, { concurrency, staleAfterMs })`, provides `healthLayer(boardRoot)` from `@shivaedev/work-fleet/host/healthLayer.ts`, and wraps its provider with `providerHealth` from `@shivaedev/work-fleet/host/providerHealth.ts`. Capacity comes only from structured `rateLimitExceeded`, `flexUnavailable` or `serverOverloaded` errors; unclassified rejection text is not treated as capacity. A repeatedly observed terminal turn does not refresh the same rejection's timestamp.

### Answer a worker question

Cloud worker prompts instruct workers to stop for a decision with `FLEET_QUESTION: <question>` and include the context and choices needed to answer. Fleet recognizes this marker in a completed worker or repair turn, publishes the question through Board's response writer, and keeps the work in Needs human. `work-fleet wait <id>` exits with code 2 while that question is open. Questions must use this explicit marker; Fleet does not infer questions from prose.

Record a nonempty answer through Board's response page or response API. Reconciliation continues the exact worker thread with the answer body under current approval, quota and capacity policy. The response receipt and continuation intent commit together before submission. Concurrent resolution, repeated resolution and restart do not submit the answer again; a lost acknowledgement reconciles the stored operation. If a crash occurs before submission and no authoritative receipt is available, Fleet retains the uncertain operation for human inspection. Clarification, deferral, changed context and competing answers keep the work blocked. Answer text supplies task input and does not grant delivery authority. `src/engine/workerQuestion.spec.ts`, `src/engine/workerContinuation.spec.ts` and `src/host/workerQuestion.spec.ts` cover these rules with a synthetic provider and real PostgreSQL.

### Return a research report

Declare `fleet-deliverable: report` on an approved task to request research. Report workers leave repository sources unchanged and return the whole report in the final message. They may create new uncommitted attachment files such as screenshots, but must never commit, push, create branches or open PRs. Omit the field to keep the PR workflow.

```markdown
---
id: research.example
kind: task
fleet: approved
fleet-deliverable: report
---
# Compare the available approaches
```

After a completed worker turn, Fleet publishes an ordinary `kind: result` item under `responses/fleet-report.<digest>.md`, with an `informs` relationship to the task. The result preserves the whole final output and records the exact session, turn and task revision in its worker receipt. The Markdown gateway uses Board's durable publisher; custom gateways implement `BoardGateway.report` with the same immutable, idempotent boundary. A publication retry reuses the same identity and bytes, including after a lost acknowledgement.

The CLI host downloads new regular files from the completed Cloud task's backend diff into `responses/fleet-report.<digest>.attachments/` beside the result, with links in the report. Text and Git binary patches are supported; edits to existing files, symlinks, unsafe paths, unavailable downloads or mismatched turns need a human. Existing attachment bytes are never replaced. Markdown attachments receive a `.attachment` suffix so Board does not index them as authored items. Collection accepts exactly one mode line per section, for a new `100644` or `100755` file. After applying the diff in a temporary folder, it checks each attachment with `lstat`, checks its resolved path stays inside that folder and opens it without following a symlink. Diff text is limited to 8 MiB, the streamed task response to 16 MiB, attachment count to 64 and total attachment bytes to 32 MiB. Exceeding a limit needs a human with the limit named, before any report or attachment is written to Board. Collection never stages, commits or publishes the diff.

After a terminal report turn, the host checks the configured GitHub remote for the exact `<branchPrefix><workId>` ref and all PRs opened from that branch, including closed PRs. A published branch or PR makes the work Needs human with the reason `Report worker published to GitHub`; Fleet never deletes the branch. Unavailable remote evidence also blocks completion. The host rechecks before result publication on retry. Custom headless runtimes provide their report inspection and collection boundaries; the Markdown gateway alone publishes report text.

Successful publication records the report in the current Board read pass and completes the Fleet attempt without PR adoption, independent review, checks or delivery. Empty or whitespace-only output, or a complete report document over Board’s 256 KiB UTF-8 context limit, creates a human decision with a concrete reason instead of a result. The size check includes metadata, the worker receipt and attachment links, and runs before writing attachment files. Oversized reports leave no attachment folder. `src/host/attachmentSize.spec.ts` covers rejection before attachment writes, including a report that fits the limit until attachment links are added. `wait` and the status views expose the same terminal states and result path. A retry after a publication failure republishes the existing completed attempt; a retry after empty output prepares another worker attempt. Oversized output remains blocked until a human resolves it; scheduler passes do not repeat publication. `src/board/publishReport.test.ts` and `src/host/reportSize.spec.ts` cover the size boundary, immediate visibility and durable human decision. These prompts direct worker behavior; runtime policy still owns execution authority.

### Cloud provider

The hosted Codex transport sends the configured environment and launch fields, then reads the final answer from a terminal turn. It authenticates from a Codex login file and can run a configured refresh command for an expired login. Failed refresh remains unavailable. These boundaries are tested with a synthetic WebSocket backend in `src/providers/codexCloud.test.ts`.

Cloud host configuration accepts `cloud.threadNamePrefix` (default `Fleet: `), `cloud.projectId` for an existing project, and `cloud.archiveThreads` (default `true`). Names use `<prefix><work-id>: <title>` from the prepared Board context's first heading. Titles have normalized whitespace and at most 80 Unicode characters, with an ellipsis when trimmed; a missing heading falls back to the work ID. Separate reviewer and repair threads add `(review)` or `(repair)` after the work ID. A repair that continues the worker thread retains its name. The Fleet session journal resolves names from persisted operation intents, so review integrations that start through the same session service receive reviewer names automatically.

Fleet persists the session acknowledgement before naming it. Launch naming retains the acknowledged work ID and loads only that record; `src/engine/sessionNaming.spec.ts` proves one lookup with both one and 1,000 stored records, and rejection of missing or ambiguous intents without scanning other records. Naming is best-effort: a rejected or failed request logs a warning with the session ID and cause, then Fleet starts the turn. Project assignment is sent with `thread/start`. `work-fleet name-threads` reads all stored Fleet records, including archived cycles and acknowledged sessions without turns, and renames threads whose current names differ from their Fleet names. It reports each rename to stdout and each read or rename failure to stderr, then continues other sessions. Shared threads are visited once and retain their original role and context. Repeating the command skips successful names and retries failures. `src/engine/threadNames.test.ts`, `src/providers/cloudMetadataFlow.spec.ts` and `src/host/cloudThreadNamesFlow.spec.ts` cover formatting, startup ordering, best-effort failures and backfill idempotence with real PostgreSQL and a synthetic Cloud backend.

Restart the host with the same SQL namespace. An attempt intent commits before `thread/start`, its session acknowledgement commits before `turn/start`, and its turn acknowledgement commits before observation. SIGKILL tests against real PostgreSQL and a synthetic Cloud server cover both sides of these mutations and recovery of 100 concurrent attempts with lost turn acknowledgements. These tests prove host persistence and Cloud adapter wire behavior; they do not prove live hosted execution.

If the session ID is known, reconciliation searches the provider's turn pages for the persisted operation ID and adopts the exact existing receipt. No observable match does not authorize replay. If the thread acknowledgement itself was lost, the current protocol cannot locate that thread by operation ID: Fleet retains the attempt and reservation and raises a human blocker. A retry continues reconciliation; it cannot authorize another launch for the unresolved attempt. Provider unavailability after session acknowledgement and a mismatched setting after thread creation also retain unresolved ownership.

Fleet cleans up worker, repair and reviewer threads after accepted completion or explicit safe release, and after renewal makes a prior conversation unusable for further repair. Terminal provider turns alone do not trigger cleanup: review, checks and human retry can still require the conversation. Cleanup deduplicates shared repair threads, includes acknowledged sessions without a turn, and persists completion markers. Archive failures leave the Fleet outcome accepted; scheduler reconciliation retries pending cleanup, including after restart or renewal, without repeating delivery. `cloud.archiveThreads: false` retains sessions and settles cleanup for that cycle. Transports without an archive capability also retain their sessions.

The adapter sends `thread/archive` and `thread/name/set`; grouping uses `thread/start.projectId`. The generated experimental app-server protocol also declares `thread/metadata/update.projectId` and `thread/list.projectId`, but Fleet does not call those methods. PostgreSQL regressions prove the cleanup lifecycle, and a synthetic WebSocket backend verifies the host configuration and wire requests. These fixtures do not prove hosted acceptance or removal from the ChatGPT and Codex sidebars.

Cloud worker instructions include startup waiting, the configured environment script, fetching current main, repository checks and one pull request for human review. Workers watch CI after every push, repair failures on the same branch, merge current main when behind and state the exact head's CI result before the marker line. They ask for a final `FLEET_PR: <url>` or `FLEET_PR: none` line. The parser reads the last marker line; missing or malformed reports yield no result. `src/prompt/worker.test.ts` covers the instructions and parser. A report line is not proof of an adopted result or accepted delivery.

### Adopt a worker result

Select `"result": "github"` in the host's `fleet.config.json` to adopt a completed worker report through the authenticated `gh` CLI. The final two report lines are one `FLEET_HEAD: <sha>` line with the full head SHA and one `FLEET_PR: https://github.com/<owner>/<repo>/pull/<number>` line. Both markers tolerate surrounding whitespace and backticks around their values. Adoption records the GitHub PR number, exact head and all paginated changed paths, including both paths of a rename. The PR must be open in the host repository and target its configured branch; a different reported head or movement during observation fails with a typed `FleetFailure`.

A final `FLEET_PR: none` claims no change at the reported `FLEET_HEAD`. Fleet retains that head and the report as evidence, and passes the result through independent review and required checks. Main movement does not invalidate the report; a changed task revision prevents adoption. Fixture tests exercise GitHub responses and the PostgreSQL adoption path, not live GitHub or worker execution.

`src/host/githubResult.test.ts`, `src/host/githubResultFailures.spec.ts` and `src/engine/resultAdoption.spec.ts` cover these adoption boundaries.

### Independent review

After adopting a result, Fleet starts an independent reviewer through the same `SessionService`, provider and durable journal as workers. Reviewers receive the Board task and criteria plus the adopted result at its exact head, without the worker conversation or preparation prompt. They use `FleetPolicy.launch` from host configuration; task launch overrides remain worker and repair settings. The Codex adapters request read-only execution with shell network access for read-only PR and exact-head CI inspection, and no escalation. Reviewers use existing exact-head repository objects, read-only repository tools or `gh pr view`, `gh pr diff` and `gh api --method GET`; network writes are prohibited and missing access ends without an accepted verdict.

The reviewer ends with `FLEET_REVIEW:` followed by JSON containing `head`, `verdict` (`approve` or `changes`), nonempty `evidence` and `findings`. Changes require concrete findings; approval requires an empty findings array. Fleet accepts this verdict only after the exact turn completes and records it with that revision and receipt. Accepted or running turns keep their execution slot without a verdict. A lost acknowledgement reconciles the existing operation. Failed turns and malformed verdicts produce a human decision. A moved PR head retains the prior revision's review and requires a fresh reviewer before checks or delivery.

`src/engine/reviewerSession.spec.ts`, `src/engine/recovery.spec.ts`, `src/prompt/reviewer.test.ts` and `src/providers/readOnly.spec.ts` cover these boundaries with real PostgreSQL and synthetic providers; they do not prove live Cloud review.

### Required checks

The command host reads GitHub check runs and commit statuses through an authenticated `gh` CLI for the adopted PR's exact commit SHA, including all pages. Pending or absent checks keep work in validation; failed checks send their names and links to the repair worker. A newer push does not replace the adopted head's evidence. Every observed check must succeed, be neutral or be skipped; this does not establish branch protection or merge authority. `src/host/githubChecks.test.ts` and `src/engine/validation.spec.ts` cover these rules with synthetic GitHub responses and real PostgreSQL.

For built capabilities and open host integrations, see the [roadmap](https://github.com/ShivaeDev/platform/blob/main/packages/work-fleet/docs/roadmap.md).

### Human delivery

Fleet never submits a merge. Reviewed, green PRs wait in Needs human as ready to merge. Reconciliation keeps observing the adopted PR through `gh pr view` with the host's existing CLI authentication, accepts only a merge of the reviewed head and records the PR head and merge commit. A PR closed without merging stays in Needs human with that fact, as does a PR whose head moved after review. A temporary observation failure preserves the current Board decision and ownership until GitHub evidence is available again. `src/host/githubDelivery.test.ts`, `src/engine/humanDelivery.spec.ts` and `src/engine/deliveryObservation.spec.ts` cover these rules with synthetic GitHub responses and real PostgreSQL.

## Compose the Effect core

Each scheduler pass shares one Board read and identity index across admission, dispatch and reconciliation. The next pass reads changed, added and removed files again. Approval and decisions remain bound to the exact source revision read. Fleet's own publications enter the current snapshot after they are recorded; reconciliation that outlives the pass reads fresh sources.

Provide `BoardGateway`, `FleetRepository`, `FleetPolicy`, `FleetIntegrations` and `SessionService` to `Fleet.layer`. The Markdown gateway reads Board context, and `postgresFleetRepository(namespace?)` supplies durable SQL attachments on a native `SqlClient`. A session journal persists intents and acknowledged turns before further remote mutation. `src/session/service.test.ts` and `src/engine/recovery.spec.ts` cover receipt ordering and recovery without duplicate launch.

```ts
import { Fleet } from "@shivaedev/work-fleet/fleet.ts";
import { cycle } from "@shivaedev/work-fleet/engine/scheduler.ts";

const fleet = yield* Fleet;
yield* fleet.prepare({ workId, preparation, prompt, cwd });
yield* cycle;
```

Run this Effect program with your composed Fleet Layer. `FleetIntegrations` supplies source observations, actual result adoption, required checks and delivery observation. Its `result` implementation must re-read current result ownership and head each time it is called. Review and checks must name the exact adopted head; the reviewer must use a different session from the worker. `src/engine/completion.spec.ts` tests those requirements, repair and validated no-change with real PostgreSQL and synthetic integrations.

Dependencies require accepted outcomes for their current Board revisions. Criterion-specific references remain blocked. `src/engine/dependencies.spec.ts` covers those boundaries. The core's native RPC commands and derived views are covered by `src/engine/rpc.spec.ts` and `src/engine/activeViews.spec.ts`. These library tests do not prove live provider execution or delivery.
