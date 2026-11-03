# @shivaedev/reconciler

Keep background work in agreement with current data without repeatedly scanning an idle database. A reconciler wakes at startup, when its changes keys are invalidated, or when its next reported deadline arrives. Each has its own scope, readable state and resume operation.

## Wake when there is work

```ts
const worker = yield* run({
  keys: [tasks.list],
  read: pendingTasks,
  act: reconcileTasks,
  due: (tasks, now) => nextDeadline(tasks, now),
});
```

`run` comes from `@shivaedev/reconciler/run.ts`. The application supplies `tasks`, its read, action and deadline calculation. Changes arriving during an action merge into one pending pass, which reads current state once.

## Using it

### Connect writes and reads

Use the same `collection` keys for your writes and reconciler. Provide native Reactivity to both; Platform's PostgreSQL layer already supplies it. Writes recorded through `changes` and `transact` wake readers after commit. A rollback never wakes them.

```ts
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { collection } from "@shivaedev/changes/keys.ts";
import { run } from "@shivaedev/reconciler/run.ts";
import { changes } from "@shivaedev/sql/changes.ts";
import { transact } from "@shivaedev/sql/transact.ts";

const tasks = collection("tasks", Schema.Int);
const application = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const worker = yield* run({
		keys: [tasks.list],
		read: sql<{ id: number; title: string }>`select id, title from tasks order by id`,
		act: (rows) => Effect.logInfo(rows),
		onFailure: (cause) => sql`insert into worker_failures (cause) values (${String(cause)})`,
	});
	yield* Effect.gen(function* () {
		yield* sql`update tasks set title = 'ready' where id = 1`;
		yield* changes({ tasks: [tasks.item(1)] }).record();
	}).pipe(transact({ onSqlError: (error) => error }));
	return worker;
});
```

Run `application` inside the application's lifetime scope with its SQL layer. The application creates its tables and chooses the failure record schema. `onFailure` is optional; no storage service or schema belongs to the engine. The callback runs after the failed generation's scope closes, and a stored record remains after resume.

The subscription is registered before the first read. The engine consumes wakes from a single pending slot and reads only when it consumes one; it has no polling interval. A burst during a pass adds one subsequent pass. Reads and actions retain their typed errors and service requirements.

### Deadlines

`due(value, now)` returns an absolute timestamp in milliseconds or `undefined`. For several deadlines, return the earliest one that needs attention. The calculation runs after the action using that pass's read value and the current clock. Each pass replaces the old timer. A timestamp at or before `now` leaves no timer: the action should already handle that due work. Returning `undefined` removes the timer.

### Supervision

Types `Reconciler`, `State` and `Due` come from `@shivaedev/reconciler/Reconciler.ts`. `run` returns a `Reconciler<E>` with these native Effect values:

| Member    | Meaning                                                                                           |
| --------- | ------------------------------------------------------------------------------------------------- |
| `state`   | Native `SubscriptionRef` with `running`, `waiting` and its `nextDue`, or `failed` and its `cause` |
| `refresh` | Manually enqueue a pass                                                                           |
| `await`   | Await termination, retaining typed errors and interruption                                        |
| `resume`  | Start a fresh generation after failure                                                            |

A defect or typed failure stops that reconciler and closes its scope. Other reconcilers continue. Resume starts with a new subscription, pending slot, timer and startup pass. The original service context is retained. Closing the owning scope interrupts the reconciler and removes its timer; interruption does not invoke `onFailure`. There is no automatic retry. If failure recording also fails, the failed state and `await` retain both causes.

### Keyed work

```ts
import { each } from "@shivaedev/reconciler/each.ts";

const worker = yield* each({
  keys: [tasks.list],
  read: pendingTasks,
  key: (task) => task.id,
  act: processTask,
});
```

`each` starts scoped work for every unclaimed key. A successful action remains claimed while its key stays present, so another wake does not repeat it. Removing a key interrupts its unfinished action and releases its claim; reappearance starts fresh work. A child defect fails the reconciler and closes its sibling actions. The returned handle, optional `due` calculation and `onFailure` callback follow the same lifecycle as `run`. State describes the snapshot pass; keyed actions can remain active while it is waiting.

### Install and limits

```sh
pnpm add @shivaedev/reconciler effect
```

Use `@shivaedev/sql` for SQL transaction announcements. Reactivity is process local; cross-process delivery uses the SQL package's existing notification binding. The reconciler provides no durable queue, distributed claim or exactly-once external side effect. Applications choose idempotency and transaction boundaries.
