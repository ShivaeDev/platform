import { Effect, Exit, Fiber, Redacted, Scope } from "effect";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { authDatabase } from "#server/better-auth/mount.ts";
import { disconnectGate } from "#test/disconnectGate.ts";
import { databaseUrl, postgres } from "./postgres.ts";

interface Engine {
	closing?: Fiber.Fiber<void>;
	readonly gate: Effect.Success<ReturnType<typeof openGate>>;
	pids: readonly number[];
	readonly scope: Scope.Closeable;
}

const openGate = Effect.fnUntraced(function* () {
	const database = yield* PostgresTestDatabase;
	const gate = yield* Effect.acquireRelease(
		Effect.promise(() => disconnectGate(Redacted.value(database.url))),
		(resource) => Effect.promise(resource.close),
	);
	yield* Effect.addFinalizer(() => Effect.sync(gate.release));
	return gate;
});

function closing(engine: Engine) {
	if (engine.closing === undefined) {
		throw new Error("The auth database scope has not started closing");
	}
	return engine.closing;
}

export const providerTeardown = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create(): Effect.fn.Return<Engine, never, PostgresTestDatabase | Scope.Scope> {
		const gate = yield* openGate();
		const scope = yield* Scope.fork(yield* Scope.Scope);
		return { gate, pids: [], scope };
	},
	inspect: ({ pids }) => ({ pids }),
	layer: postgres,
	name: "auth database teardown",
	runIf: databaseUrl !== undefined,
	stages: ["pool"],
	verbs: (engine, story) => ({
		acknowledgeDisconnects: () => {
			story.tell("PostgreSQL's disconnect acknowledgements reach the pool");
			return Effect.sync(engine.gate.release);
		},
		closeOutcome: () => Fiber.join(closing(engine)).pipe(Effect.as("closed")),
		closeProgress: () => Effect.sync(() => (closing(engine).pollUnsafe() === undefined ? "waiting" : "closed")),
		closeScope: () =>
			Effect.gen(function* () {
				story.tell("the scope that owns the auth database closes while PostgreSQL's disconnect acknowledgements are held");
				engine.closing = yield* Scope.close(engine.scope, Exit.void).pipe(Effect.forkChild);
				yield* Effect.promise(() => engine.gate.disconnecting);
			}),
	}),
});

export const twoClientsConnected = providerTeardown.trait(
	"pool",
	"the auth database pool, reached through a proxy that can hold disconnect acknowledgements, has two clients connected",
	function* (engine) {
		const pool = yield* authDatabase(Redacted.make(engine.gate.url)).pipe(Scope.provide(engine.scope));
		engine.pids = yield* Effect.promise(async () => {
			const clients = await Promise.all([pool.connect(), pool.connect()]);
			try {
				return await Promise.all(
					clients.map(async (client) => (await client.query<{ pid: number }>("select pg_backend_pid() as pid")).rows[0]?.pid ?? 0),
				);
			} finally {
				for (const client of clients) {
					client.release();
				}
			}
		});
	},
);
