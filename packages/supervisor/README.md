# @shivaedev/supervisor

Own an application's local processes with the same Effect scopes that own the application. Wait for readiness, restart crashed children with backoff, and stop them when their scope closes.

## Why you want this

A desktop shell or development host should not need its own process supervisor. Express startup order in application code, then let each process live inside a scope:

```ts
const application = Effect.scoped(
	Effect.gen(function* () {
		const database = yield* supervise(startDatabase, { name: "postgres" });
		const server = yield* supervise(startServer(database.ready), { name: "server" });
		yield* supervise(startRunner(server.ready), { name: "runner" });
		yield* Effect.never;
	}),
);
```

Each `start` is a scoped Effect. `supervise` returns after that process is ready, so the next line can use its readiness data.

## Using it

### Process ownership

`supervise(start, options)` evaluates `start` in a fresh scope for each attempt. The returned process supplies a PID, a readiness Effect and an exit Effect. An unexpected exit closes that attempt's scope, waits for backoff, and starts another attempt. Closing the caller's scope interrupts supervision and releases every attempt it owns.

The application expresses dependencies by awaiting one supervisor before starting the next. It also chooses whether a later dependency restart should restart its dependents; the package does not infer a dependency graph.

### Spawn a process and read its readiness signal

The process adapter uses Effect's `ChildProcessSpawner`. Supply its implementation at the application boundary:

```ts
import { NodeServices } from "@effect/platform-node";
import { Effect, Schema } from "effect";
import { spawn } from "@shivaedev/supervisor/spawn.ts";
import { jsonReadiness } from "@shivaedev/supervisor/readiness.ts";
import { supervise } from "@shivaedev/supervisor/supervisor.ts";

const serve = Effect.scoped(
	Effect.gen(function* () {
		const server = yield* supervise(
			spawn({
				command: "node",
				args: ["server.js"],
				readiness: jsonReadiness(Schema.Struct({ port: Schema.Int })),
				onOutput: ({ source, text }) => Effect.logInfo(text).pipe(Effect.annotateLogs({ source })),
			}),
			{
				name: "server",
				readinessTimeout: "30 seconds",
				backoff: { initial: "500 millis", maximum: "5 seconds" },
			},
		);
		yield* Effect.logInfo(`Listening on ${server.ready.port}`);
		yield* server.await;
	}),
).pipe(Effect.provide(NodeServices.layer));
```

The first stdout line is a JSON readiness message, such as `{"port":3000}`. The decoder preserves Schema failures and reports `ReadinessMissing` if stdout ends without a line. Both stdout and stderr are captured as lines, including readiness and later output. `onOutput` receives each line; its default writes Effect logs with the PID and source.

A custom `readiness` function consumes the stdout line Stream and returns an Effect with application readiness data. Use `withoutReadiness` from the same readiness module for a child that is ready as soon as it is spawned. The adapter keeps draining its output.

The adapter accepts `cwd`, environment overrides in `env`, and a `stopTimeout` that defaults to five seconds. Scope cleanup sends SIGTERM and escalates to SIGKILL through the process spawner when the child does not exit. Choose the spawner implementation at your application's boundary.

### Observe supervision and failures

The returned `ready` value comes from the first successful handshake. `state` is a native `SubscriptionRef`: its `ready` state carries the current PID and readiness value; `backoff` carries the restart count, delay in milliseconds and native `Exit` from the previous attempt. Backoff doubles after each exit up to the configured maximum. The defaults are 500 milliseconds and five seconds.

Startup fails with the original acquisition or readiness failure, `ReadinessTimeout`, or `ProcessExited` when the child exits successfully before readiness. Signal termination remains a native platform failure during startup; after readiness it is an unexpected exit and triggers a restart. A failed acquisition or readiness check on a replacement stops supervision, sets the `failed` state with its native Cause, and fails `await` in the typed error channel. `await` otherwise runs until interrupted. Interruption stays interruption and never triggers a restart.

### API and installation

Import names from their defining modules:

- `supervisor.ts`: `supervise`, `SupervisorOptions`, `ProcessState`.
- `Process.ts`: the `Process` port for another scoped process adapter.
- `spawn.ts`: `spawn`, `SpawnOptions`, `Output`.
- `readiness.ts`: `jsonReadiness`, `withoutReadiness`, `ReadinessMissing`.
- `ReadinessTimeout.ts` and `ProcessExited.ts`: typed startup failures.

```sh
pnpm add @shivaedev/supervisor effect @effect/platform-node
```

The package needs Node.js 24 or later. The bundled adapter uses native process signals; process-tree cleanup follows the supplied spawner's platform semantics.
