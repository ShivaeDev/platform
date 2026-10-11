# @shivaedev/work-fleet

Work Fleet launches approved Work Board items and keeps execution receipts in PostgreSQL. Use its command to schedule workers and inspect progress, or compose its Effect services with your own result, review, validation and delivery integrations.

## Keep approved work moving

Approve an item in Board, then let Fleet admit it and observe its worker. The host tests exercise this loop without launching an external worker.

```sh
work-fleet run <board-dir>
```

## Use the command

Board owns authored work and its revision. Fleet stores preparation, attempts and outcomes against that identity in PostgreSQL. A terminal worker turn is execution evidence; accepted completion also needs result adoption, independent review, checks and authorized delivery or validated no-change. The core tests exercise those completion paths with synthetic integrations.

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

### Cloud provider

The hosted Codex transport sends the configured environment and launch fields, then reads the final answer from a terminal turn. It authenticates from a Codex login file and can run a configured refresh command for an expired login. Failed refresh remains unavailable. These boundaries are tested with a synthetic WebSocket backend in `src/providers/codexCloud.test.ts`.

Cloud worker instructions include startup waiting, the configured environment script, fetching current main, repository checks and one pull request for human review. They ask for a final `FLEET_PR: <url>` or `FLEET_PR: none` line. The parser reads the last marker line; missing or malformed reports yield no result. `src/prompt/worker.test.ts` covers the instructions and parser. A report line is not proof of an adopted result or accepted delivery.

### Required checks

The command host reads GitHub check runs and commit statuses through an authenticated `gh` CLI for the adopted PR's exact commit SHA, including all pages. Pending or absent checks keep work in validation; failed checks send their names and links to the repair worker. A newer push does not replace the adopted head's evidence. Every observed check must succeed, be neutral or be skipped; this does not establish branch protection or merge authority. `src/host/githubChecks.test.ts` and `src/engine/validation.spec.ts` cover these rules with synthetic GitHub responses and real PostgreSQL.

For built capabilities and open host integrations, see the [roadmap](https://github.com/ShivaeDev/platform/blob/main/packages/work-fleet/docs/roadmap.md).

## Compose the Effect core

Provide `BoardGateway`, `FleetRepository`, `FleetPolicy`, `FleetIntegrations` and `SessionService` to `Fleet.layer`. The Markdown gateway reads Board context, and `postgresFleetRepository(namespace?)` supplies durable SQL attachments on a native `SqlClient`. A session journal persists intents and acknowledged turns before further remote mutation. `src/session/service.test.ts` and `src/engine/recovery.spec.ts` cover receipt ordering and recovery without duplicate launch.

```ts
import { Fleet } from "@shivaedev/work-fleet/fleet.ts";
import { cycle } from "@shivaedev/work-fleet/engine/scheduler.ts";

const fleet = yield* Fleet;
yield* fleet.prepare({ workId, preparation, prompt, cwd });
yield* cycle;
```

Run this Effect program with your composed Fleet Layer. `FleetIntegrations` supplies source observations, actual result adoption, independent review, required checks and authorized delivery. Review and checks must name the exact adopted head; the reviewer must use a different session from the worker. `src/engine/completion.spec.ts` tests those requirements, repair and validated no-change with real PostgreSQL and synthetic integrations.

Dependencies require accepted outcomes for their current Board revisions. Criterion-specific references remain blocked. `src/engine/dependencies.spec.ts` covers those boundaries. The core's native RPC commands and derived views are covered by `src/engine/rpc.spec.ts` and `src/engine/activeViews.spec.ts`. These library tests do not prove live provider execution or delivery.

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
addon does not rewrite authored task status or maintain competing status files.

### Start a small personal pilot

The smallest host is an Effect program with the composed Fleet Layer above; it can
run headlessly. The package supplies no provider login, hosting-specific merge
command or account reset. Configure these runtime boundaries before dispatch:

1. Use one Board root and durable SQL namespace. Record exact approved Board
   revisions in runtime policy, with current provider quota observations.
2. Supply a verified `SessionTransport` with working provider access. If using the
   local adapter, connect it to an independently owned local app-server; its lifetime
   must survive the host's observing scopes.
3. Implement current source observations, exact result/PR adoption, independent
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

The Codex app-server contract is experimental. A local app-server is distinct from
hosted modern Cloud. No hosted adapter, endpoint or authentication contract is
inferred from `codex cloud exec`; hosted capability is an injected transport.
The [roadmap](https://github.com/ShivaeDev/platform/blob/main/packages/work-fleet/docs/roadmap.md)
records validation boundaries and personal pilot follow-up.

The addon is currently private in the workspace, pending the maintainer’s release
decision. Its packed consumer is validated alongside the compatible `effect` peer. PostgreSQL connection,
provider connection and delivery authority come from trusted runtime configuration;
no credentials or operational records belong in Board source or public fixtures.
