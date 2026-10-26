import { Effect, Exit, Fiber, Layer, Redacted, Scope } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import { databaseUrl, postgres } from "@shivaedev/identity/test-support/better-auth/postgres.ts";
import { disconnectGate } from "@shivaedev/identity/test-support/disconnectGate.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { appDatabase } from "#server/appHost.ts";

export const poolTeardown = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		const database = yield* PostgresTestDatabase;
		const gate = yield* Effect.acquireRelease(
			Effect.promise(() => disconnectGate(Redacted.value(database.url))),
			(resource) => Effect.promise(resource.close),
		);
		const scope = yield* Scope.fork(yield* Scope.Scope);
		yield* Effect.addFinalizer(() => Effect.sync(gate.release));
		const name = `pool-teardown-${crypto.randomUUID()}`;
		const context = yield* Layer.buildWithScope(
			appDatabase({ config: { applicationName: name, databaseUrl: Redacted.make(gate.url) }, migrations: { loader: Migrator.fromRecord({}) } }),
			scope,
		);
		const sql = yield* SqlClient.SqlClient.pipe(Effect.provideContext(context));
		yield* sql`select 1`;
		return { gate, name, scope };
	},
	layer: postgres,
	name: "database pool teardown",
	runIf: databaseUrl !== undefined,
	stages: [],
	verbs: ({ gate, name, scope }, story) => ({
		backendQueries: Effect.fn("PoolTeardown.backendQueries")(function* () {
			const sql = yield* SqlClient.SqlClient;
			return yield* sql<{ readonly query: string }>`select query from pg_stat_activity where application_name = ${name} order by query`;
		}),
		backends: Effect.fn("PoolTeardown.backends")(function* () {
			const sql = yield* SqlClient.SqlClient;
			return yield* sql<{ readonly pid: number }>`select pid from pg_stat_activity where application_name = ${name}`;
		}),
		close: () => {
			story.tell("close the application database while the peer holds its disconnect acknowledgement");
			return Scope.close(scope, Exit.void).pipe(Effect.forkChild);
		},
		disconnecting: () => Effect.promise(() => gate.disconnecting),
		releaseDisconnects: () => Effect.sync(gate.release),
		shutdownResult: (fiber: Fiber.Fiber<void>) => Effect.sync(() => fiber.pollUnsafe()),
		waitForShutdown: (fiber: Fiber.Fiber<void>) => Fiber.join(fiber),
	}),
});
