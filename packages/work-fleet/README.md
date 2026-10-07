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
