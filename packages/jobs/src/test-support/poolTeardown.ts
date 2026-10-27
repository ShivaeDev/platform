import { Effect, Exit, Fiber, Layer, Redacted, Scope } from "effect";
import { SqlClient } from "effect/sql";
import { PgBoss } from "pg-boss";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { defaultClientFactory, type PgBossClientFactory } from "#client.ts";
import { makePgBoss } from "#service.ts";
import { disconnectGate } from "#test/disconnectGate.ts";
import { postgresConfigured, postgresLayer } from "#test/postgresLayer.ts";
import { waitingVerbs } from "#test/waitingVerbs.ts";

const Jobs = makePgBoss("@test/PoolTeardown");
export const poolTeardown = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		const database = yield* PostgresTestDatabase;
		const gate = yield* Effect.acquireRelease(
			Effect.promise(() => disconnectGate(Redacted.value(database.url))),
			(value) => Effect.promise(value.close),
		);
		return {
			gate,
			name: `pool-teardown-${crypto.randomUUID()}`,
			scope: yield* Scope.fork(yield* Scope.Scope),
			stopped: Promise.withResolvers<void>(),
		};
	},
	inspect: ({ name }) => ({ name }),
	layer: postgresLayer,
	name: "jobs pool teardown",
	runIf: postgresConfigured,
	stages: [],
	verbs: ({ gate, name, scope, stopped }, story) => ({
		...waitingVerbs(),
		backends: Effect.fn("PoolTeardown.backends")(function* () {
			const sql = yield* SqlClient.SqlClient;
			return yield* sql<{ readonly pid: number }>`select pid from pg_stat_activity where application_name = ${name}`;
		}),
		close: () => {
			story.tell("close the jobs scope while the peer holds its disconnect acknowledgement");
			return Scope.close(scope, Exit.void).pipe(Effect.forkChild);
		},
		nativeStopped: () => Effect.promise(() => stopped.promise),
		open: Effect.fn("PoolTeardown.open")(function* (factory: PgBossClientFactory = defaultClientFactory) {
			story.tell("open the jobs client through a PostgreSQL disconnect gate");
			yield* Effect.addFinalizer(() => Effect.sync(gate.release));
			yield* Layer.buildWithScope(
				Jobs.layer({
					"application_name": name,
					clientFactory: (options) => {
						const client = factory(options);
						if (!(client instanceof PgBoss)) {
							throw new Error("The transport story needs a real pg-boss client");
						}
						client.once("stopped", () => stopped.resolve());
						return client;
					},
					connectionString: gate.url,
					jobs: [],
					schedule: false,
					supervise: false,
				}),
				scope,
			);
		}),
		releaseDisconnects: () => Effect.sync(gate.release),
		shutdownResult: (fiber: Fiber.Fiber<void>) => Effect.sync(() => fiber.pollUnsafe()),
		waitForShutdown: (fiber: Fiber.Fiber<void>) => Fiber.join(fiber),
	}),
});
