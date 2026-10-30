import { Effect, Layer, Logger, References, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { defaultClientFactory, type PgBossClient } from "#client.ts";
import { makePgBoss, pgBossLayer } from "#service.ts";
import { postgresConfigured, postgresLayer } from "#test/postgresLayer.ts";

const Jobs = makePgBoss("PoolRecoveryJobs");
const BackendPids = Schema.Array(Schema.Struct({ pid: Schema.Number }));

export const poolRecovery = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	create: () =>
		Effect.gen(function* () {
			const database = yield* PostgresTestDatabase;
			const logs: Array<{ readonly level: string; readonly message: unknown }> = [];
			const logger = Logger.make(({ logLevel, message }) => logs.push({ level: logLevel, message }));
			let client: PgBossClient | undefined;
			const clientLayer = pgBossLayer({
				clientFactory: (options) => {
					client = defaultClientFactory(options);
					return client;
				},
				connectionString: database.url,
				max: 1,
				migrate: true,
				schedule: false,
				supervise: false,
			});
			yield* Layer.build(
				Jobs.layer({ jobs: [] })
					.pipe(Layer.provide(clientLayer))
					.pipe(Layer.provide(Logger.layer([logger])), Layer.provide(Layer.succeed(References.MinimumLogLevel, "Debug"))),
			);
			const db = client?.getDb?.();
			if (db === undefined) {
				return yield* Effect.die("pg-boss did not open its database");
			}
			return { db, logs };
		}),
	layer: postgresLayer,
	name: "pool recovery",
	runIf: postgresConfigured,
	stages: ["pool"],
	verbs: (engine) => ({
		bossBackend: Effect.fn("PoolRecovery.bossBackend")(function* () {
			const result = yield* Effect.promise(() => engine.db.executeSql("select pg_backend_pid() as pid"));
			return Schema.decodeUnknownSync(BackendPids)(result.rows)[0]?.pid;
		}),
		logs: () => engine.logs,
		terminate: Effect.fn("PoolRecovery.terminate")(function* (pid: number | undefined) {
			if (pid === undefined) {
				return yield* Effect.die("Missing backend pid to terminate");
			}
			const sql = yield* SqlClient.SqlClient;
			yield* sql`select pg_terminate_backend(${pid}, 5000)`;
			yield* Effect.promise(() => new Promise<void>((resolve) => setImmediate(resolve)));
		}),
	}),
});
