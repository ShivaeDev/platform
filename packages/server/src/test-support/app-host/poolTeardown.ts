import { Effect, Exit, Fiber, Layer, Redacted, Scope } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import { databaseUrl, postgres } from "@shivaedev/identity/test-support/better-auth/postgres.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { appDatabase } from "#appHost.ts";
import { connectionGate } from "#test/connectionGate.ts";

export const poolTeardown = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		const database = yield* PostgresTestDatabase;
		const gate = yield* Effect.acquireRelease(
			Effect.promise(() => connectionGate(Redacted.value(database.url))),
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
	verbs: ({ gate, name, scope }, story) => {
		let closing: Fiber.Fiber<void> | undefined;
		return {
			backendQueries: Effect.fn("PoolTeardown.backendQueries")(function* () {
				const sql = yield* SqlClient.SqlClient;
				const rows = yield* sql<{ readonly query: string }>`select query from pg_stat_activity where application_name = ${name} order by query`;
				return rows.map((row) => row.query);
			}),
			closeProgress: () =>
				Effect.sync(() => {
					if (closing === undefined) {
						return "open";
					}
					return closing.pollUnsafe() === undefined ? "waiting for disconnects" : "closed";
				}),
			openConnections: () => Effect.sync(gate.openClients),
			peerAcknowledgesDisconnects: () => {
				story.tell("PostgreSQL's disconnect acknowledgements reach the application database");
				return Effect.gen(function* () {
					gate.release();
					if (closing !== undefined) {
						yield* Fiber.join(closing);
					}
				});
			},
			theDatabaseCloses: () => {
				story.tell("the application database closes while PostgreSQL holds its disconnect acknowledgements");
				return Effect.gen(function* () {
					closing = yield* Scope.close(scope, Exit.void).pipe(Effect.forkScoped);
					yield* Effect.promise(() => gate.disconnecting);
				});
			},
		};
	},
});
