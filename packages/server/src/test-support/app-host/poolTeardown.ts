import { Effect, Exit, Layer, Redacted, Scope } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { disconnectProxy } from "@shivaedev/test-sql/server/disconnectProxy.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { appDatabase } from "#appDatabase.ts";
import { databaseUrl, postgres } from "#test/postgres.ts";

export const poolTeardown = storyKit({
	around: withIsolatedDatabase,
	clock: "test",
	*create() {
		const database = yield* PostgresTestDatabase;
		const gate = yield* disconnectProxy(Redacted.value(database.url), { holdDisconnects: true });
		const scope = yield* Scope.fork(yield* Scope.Scope);
		yield* Effect.addFinalizer(() => Effect.sync(gate.release));
		const name = `pool-teardown-${crypto.randomUUID()}`;
		const context = yield* Layer.buildWithScope(
			appDatabase({
				config: { applicationName: name, databaseUrl: Redacted.make(gate.url) },
				migrations: { loader: Migrator.fromRecord({}) },
				postgresSettings: {},
			}),
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
	verbs: ({ gate, name, scope }, story) => {
		let closed = false;
		return {
			backendQueries: Effect.fn("PoolTeardown.backendQueries")(function* () {
				const sql = yield* SqlClient.SqlClient;
				const rows = yield* sql<{ readonly query: string }>`select query from pg_stat_activity where application_name = ${name} order by query`;
				return rows.map((row) => row.query);
			}),
			closeProgress: () => Effect.sync(() => (closed ? "closed" : "open")),
			openConnections: () => Effect.sync(gate.openClients),
			postgresEndsEveryBackend: () => {
				story.tell("PostgreSQL ends every backend of the application database while the gate still holds its disconnect acknowledgements");
				return Effect.promise(() => gate.allHeld).pipe(Effect.timeout("20 seconds"));
			},
			theDatabaseCloses: () => {
				story.tell("the application database closes while PostgreSQL holds its disconnect acknowledgements");
				return Effect.map(Scope.close(scope, Exit.void), () => {
					closed = true;
				});
			},
		};
	},
});
