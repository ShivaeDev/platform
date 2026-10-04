# `@shivaedev/work-fleet`

Carry an approved repository batch through coding agents, independent review,
repair and PR delivery. One local Effect process coordinates the work; SQLite
preserves intent, acknowledgements and outcomes across restarts.

Work Fleet accepts a finite plan. It keeps eligible work moving within capacity
and ownership limits, returns repair findings to the original worker session,
and generates **Active**, **Completed** and **Needs human** Markdown. Completion
means the declared reviewed outcome, not merely an agent turn ending.

## Install

Requires Node.js 24 or newer. For local Codex execution, install `codex`, sign in
with ChatGPT, and install authenticated `git` and `gh`. The installed app-server
protocol is an explicit compatibility boundary. Hosted Cloud execution and an
API-key billing fallback are not included.

After package publication:

```sh
pnpm add --global @shivaedev/work-fleet
work-fleet --help
```

From this repository before publication:

```sh
pnpm install
pnpm --filter @shivaedev/work-fleet build
pnpm --filter @shivaedev/work-fleet exec node dist/cli.js --help
```

Use that last command in place of `work-fleet` in the examples below. Keep state
and generated views outside a worker's writable checkout.

## Complete example

The operator prepares a clean, dedicated standalone clone at `/workspace/widgets`
with `origin` pointing to `acme/widgets`. Its `.git` must be a real directory;
linked worktrees and metadata symlinks are unsupported. Use a separate clone for
each concurrent writer. Substitute a repository you control for this synthetic example, and
create a writable directory for the database. No command below creates checkouts.

Save `batch.json`:

```json
{
  "id": "widget-batch",
  "works": [{
    "id": "empty-state",
    "repository": "acme/widgets",
    "checkout": "/workspace/widgets",
    "instructions": "Add an empty-state message to the widget list and test the behavior. Stay within the listed paths.",
    "scope": [
      { "path": "src/widgets", "key": null },
      { "path": "test/widgets", "key": null }
    ],
    "baseBranch": "main",
    "completion": "merged",
    "requiredChecks": ["test"],
    "pullRequest": {
      "title": "Empty widget lists explain how to add a widget",
      "body": "## Why?\n\nAn empty list gives no next step.\n\n## How?\n\nShow an empty-state message and test the behavior."
    }
  }]
}
```

PR metadata is approved public text, separate from worker instructions. The
current publisher requires `Why?` and `How?` sections. Set the check names to the
actual GitHub checks required for this work. Completion can be `pull-request`
(reviewed PR with passing required checks), `merged` (also observe its merge), or
`no-change` (reviewed justification at the exact fetched base revision, with a
clean checkout and no diff). A no-change outcome also requires every configured
commit check to have an explicit passing GitHub result on that reviewed base
revision.

```sh
work-fleet accept batch.json --database /var/lib/work-fleet/fleet.db
work-fleet decide approve empty-state --reason "The result and scope are approved" --database /var/lib/work-fleet/fleet.db
work-fleet decide merge empty-state --reason "Allow ordinary merge after review and required checks" --database /var/lib/work-fleet/fleet.db
work-fleet run --backend codex-local --database /var/lib/work-fleet/fleet.db --output ./views --interval 10
```

This grants standing merge authority for this work only. Omit the merge decision
to receive a Needs human question once the reviewed PR is ready. An approval
permits execution and publication; it does not imply merge authority.

The coordinator starts a worker, requests independent review, continues that
worker for repairs, publishes the reviewed commit, observes checks and performs
an ordinary merge. It records completion only after observing the merged
revision. Stop with Ctrl-C; restart the same command and database to reconcile
the existing attempts. Stopping the local process can interrupt its local agent
process; an unfinished turn is not assumed completed or automatically replaced.

For an offline demonstration, use a **different database**, select
`--backend scripted`, and use the same accept/decision/run commands. Scripted
providers simulate outcomes, checks and merge in the production coordinator;
they do not execute repository code, call a model or mutate GitHub. The first
tick binds a database to its backend identities, preventing simulated state from
being resumed with real adapters. Scripted remote state is a demonstration, not
a durable external provider.

## Operate

Stop `run` before using administrative commands: the SQLite process lock admits
one coordinator or administrator at a time. `tick` reconciles once; `run` polls.
`render --database ... --output ./views` regenerates the three views.

Save a full policy as JSON and apply it with `work-fleet policy policy.json
--database ...`:

```json
{ "capacity": 2, "maxAttempts": 100, "stopped": false, "quotaAvailable": true }
```

Workers and reviewers share capacity. `maxAttempts` limits the lifetime count of
attempts in this database, including review and repair; it is not a token or
money limit. Quota is an operator-supplied availability gate. `stopped` prevents
new admissions and privileged delivery writes while observations continue.
`decide hold WORK_ID --reason ...` holds one item; `resume` releases that hold.
An unresolved acknowledgement still requires reconciliation after resume.
Use `recover ATTEMPT --session SESSION --turn TURN --reason ...` to attach a
provider receipt. Use `recover ATTEMPT --not-submitted --reason ...` only after
confirming no submission occurred. Both require `--database`; known provider
turns cannot be discarded. Each recovery records a scoped decision.

Serve the generated folder with the optional Work Board package:

```sh
work-board ./views --home Active.md
```

Work Board also exports `boardLayer({ root, home })` for an existing Effect HTTP
server. Work Fleet does not bundle a web server. Generated Markdown has no
authority: editing it cannot approve work or waive a check.

## Embed

The root entry exports `Fleet`. The `/store`, `/database`, `/codex`, `/github`,
`/scripted`, `/views`, `/domain` and `/ports` entries expose their corresponding
services, Layers and contracts without loading a barrel of adapters.
A small offline composition is:

```ts
import { Effect, Layer } from "effect";
import { Fleet } from "@shivaedev/work-fleet";
import { Store } from "@shivaedev/work-fleet/store";
import { databaseLayer } from "@shivaedev/work-fleet/database";
import { scriptedLayer } from "@shivaedev/work-fleet/scripted";

const services = Fleet.layer.pipe(
  Layer.provide(Store.layer.pipe(Layer.provide(databaseLayer("fleet.db")))),
  Layer.provide(scriptedLayer()),
);

export const oneTick = Effect.gen(function* () {
  const fleet = yield* Fleet;
  yield* fleet.tick();
  return yield* fleet.snapshot();
}).pipe(Effect.provide(services));
```

Run the resulting Effect at your application's normal runtime boundary. For
real adapters, provide `codexLayer()` and `GitHubLive()` instead of the scripted
Layer, plus `NodeServices.layer` from `@effect/platform-node`. `GitHubLive`
accepts `mergeMethod: "merge" | "squash" | "rebase"`; the CLI uses ordinary merge.

## Current limitations and evidence

The local adapter requires a compatible Codex app-server and existing ChatGPT
authentication. Its explicit permission profile grants workers write access to
the dedicated clone and its `.git` directory, sets temporary directories inside
that metadata, and disables network access. Reviewers receive read-only access.
Local reads remain broad. Enabled inherited MCP servers are refused before
execution because their tools are outside the shell sandbox. Prepare dependencies
in advance; linked worktrees are unsupported. The coordinator accepts a narrow
Git configuration and disables hooks and external diff commands. Keep these
clones owner-controlled: this is not a security boundary against hostile
concurrent writers to repository metadata.

Structured-key reservations are represented, but publishing currently requires
whole-path authority for each changed file. GitHub.com is the initial host.
Reservations cover work recorded in this database; they do not discover work
owned by other sessions or tools. Deployment promotion, automatic quota discovery,
checkout creation and hosted Cloud execution are absent. Unknown submissions or partial publications can need
operator investigation; no exactly-once guarantee is claimed.

Synthetic provider and adapter contract tests exercise the application without
model calls. A synthetic repository verified local `git add` and `git commit`
under the installed OS sandbox, with no remote calls. A read-only public PR query
verified the GitHub field contract. These checks do not establish a live
model-to-merge acceptance run. See the
[architecture](./architecture.md) for recovery and authority boundaries, the
[north star](./north-star.md) for the product promise, and the
[roadmap](./roadmap.md) for remaining work.
