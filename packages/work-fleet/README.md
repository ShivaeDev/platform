# @shivaedev/work-fleet

Work Fleet carries approved Work Board items through execution, independent
review, repair, validation and authorized delivery. It keeps durable ownership
and receipts attached to the Board work so routine progress needs fewer human
handoffs.

## Keep approved work moving

A single cycle observes current attempts and admits independent prepared work.
Exceptions appear as concrete Board questions. Active, Completed and Needs human
are derived from the same execution attachments.

```ts
const fleet = yield* Fleet;
yield* fleet.prepare({ workId, preparation, prompt, cwd });
yield* cycle;
```

## Compose a headless runtime

Board owns identity, context and `depends_on` relationships. Fleet's PostgreSQL
records use those IDs; a dependent item needs an accepted outcome for the dependency's
current Board revision. Missing or ambiguous Board context blocks that dependent
item. Criterion-specific references remain blocked until criterion-specific accepted
evidence is supported. Board remains
usable without this addon. `markdownBoard(root)` reads Board's existing Markdown
model and publishes ordinary durable questions through its existing publisher.
It does not launch copied Markdown handoffs or interpret receipts as completion.

Provide `BoardGateway`, `FleetRepository`, `FleetPolicy`, `FleetIntegrations` and
`SessionService` to `Fleet.layer`. Use one SQL namespace per Board workspace.
`postgresFleetRepository(namespace?)` creates
and migrates the SQL attachments on an injected native `SqlClient`.
`fleetSessionJournal` records exact session and turn acknowledgements against
persisted attempt intents; provide that journal and `SessionTransport` to
`SessionService.layer`. Never submit a remote operation before its intent commits.

Runtime `FleetPolicy` holds exact approved Board revisions, fresh quota observations,
optional execution and delivery backlog limits, a clock and unique operation IDs.
There are no personal numeric defaults. Unknown or expired quota blocks admission.
Foreign reservations record actual scope and separate occupancy/backlog flags;
release them only after an authoritative observation permits it.

`FleetIntegrations` supplies current main observations, adoption of the actual PR
or no-change result, independent review, required checks, delivery observation,
trusted authorization and normal merge. Review and checks acknowledge the exact
head. Review receipts must differ from worker sessions. Review implementations
using a provider must use the same durable session journal and reconcile the
existing review operation after a lost response. Build and delivery policies
belong to the runtime and must enforce actual branch requirements without bypass.

The host reads GitHub check runs and commit statuses through an authenticated `gh` CLI for the adopted PR's exact commit SHA, including all pages. Pending or absent checks keep work in validation; failed checks send their names and links to the repair worker. A newer push does not replace the adopted head's evidence. The host requires all observed checks to succeed, be neutral or be skipped; this does not establish branch protection or merge authority. No-change validation still needs a runtime integration.

```ts
import { Layer } from "effect";
import { Fleet } from "@shivaedev/work-fleet/fleet.ts";
import { markdownBoard } from "@shivaedev/work-fleet/board/markdown.ts";
import { postgresFleetRepository, fleetSessionJournal } from "@shivaedev/work-fleet/engine/repository.ts";
import { FleetPolicy, FleetIntegrations } from "@shivaedev/work-fleet/policy.ts";
import { SessionService } from "@shivaedev/work-fleet/session/service.ts";

const repository = postgresFleetRepository();
const journal = fleetSessionJournal.pipe(Layer.provide(repository));
const sessions = SessionService.layer.pipe(Layer.provide([journal, provider]));
const fleet = Fleet.layer.pipe(Layer.provide([
  repository,
  sessions,
  markdownBoard(boardRoot),
  Layer.succeed(FleetPolicy)(runtimePolicy),
  Layer.succeed(FleetIntegrations)(integrations),
]));
```

`provider` supplies `SessionTransport`; `runtimePolicy` and `integrations` are
trusted runtime implementations. Provide the same native SQL Layer and Node
filesystem/path services to the composed Layer. Import `cycle` and `run` from
`@shivaedev/work-fleet/engine/scheduler.ts` and execute them with that Fleet Layer.

Call `prepare` for each approved item. Preparation records owned scope, relevant
source/dependency/setup/quality context, scoped baseline/configuration coverage
and original validation evidence. Complete current observations can refresh an
unattempted preparation after an unrelated main change; they do not assert that
validation ran again. Relevant or incompletely understood changes require scoped
preparation again. Calling `prepare` again uses the same Board ID. Renewal requires
confirmed terminal execution and approved current context; completed work requires
a newly approved Board revision. Fleet inspects any unadopted worker result before
renewing, preserves unresolved PR scope as foreign ownership, and archives prior
context, attempts, responses and evidence in `FleetRecord.history`. Ambiguous
execution or delivery must be reconciled before renewal.

`cycle` observes active work concurrently while admitting prepared items with
updated occupancy. `run(interval)` uses interruptible Effect waiting. SQL transactions are
short and do not hold a scheduler lock while remote work runs. Releasing a
terminal adopted PR transfers its actual paths into a foreign reservation until
the runtime observes that the PR no longer owns them. Ambiguous submitted
delivery cannot be released.

### Answer a worker question

Cloud worker prompts instruct workers to stop for a decision with `FLEET_QUESTION: <question>` and include the context and choices needed to answer. Fleet recognizes this marker in a completed worker or repair turn, publishes the question through Board's response writer, and keeps the work in Needs human. `work-fleet wait <id>` exits with code 2 while that question is open. Questions must use this explicit marker; Fleet does not infer questions from prose.

Record a nonempty answer through Board's response page or response API. Reconciliation continues the exact worker thread with the answer body under current approval, quota and capacity policy. The response receipt and continuation intent commit together before submission. Concurrent resolution, repeated resolution and restart do not submit the answer again; a lost acknowledgement reconciles the stored operation. If a crash occurs before submission and no authoritative receipt is available, Fleet retains the uncertain operation for human inspection. Clarification, deferral, changed context and competing answers keep the work blocked. Answer text supplies task input and does not grant delivery authority.

### Return a research report

Declare `fleet-deliverable: report` on an approved task to request read-only research. Report worker prompts forbid changes, commits, pushes, branches and PRs, and ask for the whole report in the final message. Omit the field to keep the PR workflow.

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

Successful publication completes the Fleet attempt without PR adoption, independent review, checks or delivery. Empty or whitespace-only output creates a human decision instead of a result. `wait` and the status views expose the same terminal states and result path. A retry after a publication failure republishes the existing completed attempt; a retry after empty output prepares another worker attempt. These prompts direct worker behavior; runtime policy still owns execution authority.

### Answer the current Board decision

Fleet publishes an ordinary Board decision and stores its exact `BoardDecision`
receipt in `Decision.published`. `BoardGateway.readDecision` returns `Pending`,
`Stale`, `Ambiguous` or the current `Response`, checking the reviewed question and
work context. Answer through Board's response page or authenticated response API.
Choose one guided `fleet-action`: `retry` after resolving the blocker, or `release`
when execution and delivery permit safe release. An author label or free text
cannot grant execution or merge rights; trusted runtime approval and delivery
policy still apply.

Reconciliation automatically consumes the current response and stores an idempotent
SQL response receipt, including the exact published decision. The host can also
resolve an exact response explicitly:

```ts
yield* fleet.resolve(workId, decisionId, responseId);
```

The native `Resolve` payload has the same three IDs. A repeated acknowledgement
does not repeat the action. `clarify` and `not_now` keep work in Needs human with
the current blocker. Replacing an answer, clarification or deferral requires
explicit Board supersession. Fleet does not pick among competing responses or
infer an action from the newest body. Decisions
remain usable while the scheduler runs, and the three views prefer current blockers.

After the resolution commits in SQL, `BoardGateway.acknowledgeDecision` receives a
`BoardDecisionAcknowledgement`. The Markdown adapter records an immutable Board
`kind: result` document with `request_receipt`, qualified against the exact managed
question and applicable response. Board's native attention then treats that managed
request as acknowledged; the decision and registered question sources remain
unchanged. This records request handling, not accepted work or delivery authority.

Fleet marks `DecisionResponse.boardAcknowledged` only after Board publication
succeeds. A failed or lost acknowledgement leaves a concrete pending blocker;
reconciliation retries the same receipt without repeating the SQL action. Renewal
recovers missing decision publication from the stored original Board context before
archiving it; missing original context blocks renewal. Pending acknowledgement state remains
in archived history. Reconciliation acknowledges an archived open decision as
`superseded`, retaining `decisionAcknowledged` in its history snapshot. Applied
answers use disposition `applied`; clarification and deferral leave the request open.
Custom Board gateways must implement the same durable acknowledgement boundary.

`FleetContract` and `fleetHandlers` expose preparation, dispatch, reconciliation,
decision resolution and the three derived views through native Effect RPC.
The host supplies transport and authentication. Detailed records remain available
through the native `Get` query or `Fleet.list`; completion resides in SQL attachments to the Board ID. The
addon does not rewrite authored task status.

### Read the generated heading board

The CLI host writes `fleet/status.md` inside the Board folder. It derives Active, Needs human and Done columns from the same Fleet views, with one card per current unreleased item. Cards link to the task's Board identity and its adopted PR when available. The file contains execution stages and blockers, not worker prompts, session receipts or authored task status.

After the first scheduler cycle creates the file, select it as Work Board's home:

```sh
work-board ./notes --home fleet/status.md
```

The host refreshes the view on scheduler reads and after preparation, dispatch, reconciliation and resolution. Work Board's existing file watcher refreshes an open page. Identical content leaves the file untouched. Publication failures are reported and retried on the next cycle without changing execution outcomes. The writer refuses authored content or symlinks at the generated destination. Board remains usable without Fleet; the generated file is an optional projection of SQL records. A composed headless runtime can opt into the same publication behavior by providing `statusLayer(boardRoot)` from `@shivaedev/work-fleet/host/statusLayer.ts` over its Fleet Layer and Node filesystem services.

### Start a small personal pilot

Use `work-fleet watch first-item second-item --board <folder>` to follow several items in one process. It prints one line per item when that item is completed, needs-human or released, then exits 0 after every item has reported. Duplicate IDs report once; unknown IDs remain pending. With no IDs, it follows the active items found by its first successful read and exits when those items have reported. Existing completed, needs-human and released items are excluded from that initial active set. Each poll uses one PostgreSQL query for summary fields, without loading execution history or the Fleet runtime.

`--interval <seconds>` defaults to 15; `--timeout <seconds>` exits 4 and writes a timeout message to stderr. Read failures retry up to 20 consecutive polls before exit 1. `work-fleet wait <id>` prints the same outcome summary and keeps its individual exit codes: completed 0, needs-human 2, released 3, timeout 4 and errors 1. Both commands read host settings from `<board>/fleet.config.json` or `--config <file>`.

Select `"result": "github"` in the host's `fleet.config.json` to adopt a completed worker report through the authenticated `gh` CLI. The report includes one `FLEET_HEAD: <sha>` line with the full head SHA and ends with one `FLEET_PR: https://github.com/<owner>/<repo>/pull/<number>` line. Adoption records the GitHub PR number, exact head and all paginated changed paths, including both paths of a rename. The PR must be open in the host repository and target its configured branch; a different reported head or movement during observation fails with a typed `FleetFailure`.

A final `FLEET_PR: none` claims no change at the reported `FLEET_HEAD`. The host refreshes main and requires the same SHA, retains the report as evidence, and passes that result through independent review and required checks. Result adoption supplies no review or delivery authority; configure those integrations separately. Fixture tests exercise GitHub responses and the PostgreSQL adoption path, not live GitHub or worker execution.

The smallest host is an Effect program with the composed Fleet Layer above; it can
run headlessly. The package supplies no provider login, hosting-specific merge
command or account reset. Configure these runtime boundaries before dispatch:

1. Use one Board root and durable SQL namespace. Record exact approved Board
   revisions in runtime policy, with current provider quota observations.
2. Supply a verified `SessionTransport` with working provider access. If using the
   local adapter, connect it to an independently owned local app-server; its lifetime
   must survive the host's observing scopes.
3. Configure current source observations, exact result/PR adoption, independent
   review, required checks and normal authorized delivery in `FleetIntegrations`.
   Authentication belongs to the host when exposing `FleetContract`.
4. Prepare two disjoint Board items, inspect their attached scopes and run `cycle`
   before keeping `run(interval)` active. Answer any concrete Board decision while
   it runs. Restart with the same namespace and reconcile existing receipts.

Unknown quota or unavailable provider/result ownership remains a concrete blocker.
Inspect receipts, occupancy, accepted outcomes and replacement timing during the
pilot; do not treat a terminal worker or a passing scripted integration as live
delivery evidence.

### Provider boundary

The local Codex adapter connects to an explicitly configured, independently owned
app-server. Closing its observation scope disconnects the client without requesting
remote interruption. Explicit interruption requires the exact provider acknowledgement.
Submission ambiguity retains ownership and reconciliation checks the existing turn.

The Codex app-server contract is experimental. The Cloud adapter connects to a configured hosted WebSocket endpoint, creates a thread in the configured environment and verifies that environment before submitting a turn. A local app-server remains a separate provider.

Restart the host with the same SQL namespace. An attempt intent commits before `thread/start`, its session acknowledgement commits before `turn/start`, and its turn acknowledgement commits before observation. SIGKILL tests against real PostgreSQL and a synthetic Cloud server cover both sides of these mutations and recovery of 100 concurrent attempts with lost turn acknowledgements. These tests prove host persistence and Cloud adapter wire behavior; they do not prove live hosted execution.

If the session ID is known, reconciliation searches the provider's turn pages for the persisted operation ID and adopts the exact existing receipt. No observable match does not authorize replay. If the thread acknowledgement itself was lost, the current protocol cannot locate that thread by operation ID: Fleet retains the attempt and reservation and raises a human blocker. A retry continues reconciliation; it cannot authorize another launch for the unresolved attempt. Provider unavailability after session acknowledgement and a mismatched setting after thread creation also retain unresolved ownership.

The [roadmap](https://github.com/ShivaeDev/platform/blob/main/packages/work-fleet/docs/roadmap.md)
records validation boundaries and personal pilot follow-up.

The addon is currently private in the workspace, pending the maintainer’s release
decision. Its packed consumer is validated alongside the compatible `effect` peer. PostgreSQL connection,
provider connection and delivery authority come from trusted runtime configuration;
no credentials or operational records belong in Board source or public fixtures.
