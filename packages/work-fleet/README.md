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
