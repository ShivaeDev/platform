import { Context, Effect, Layer, Logger, Redacted, References, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { defaultClientFactory, type PgBossClient } from "@shivaedev/effect-pg-boss/server/client.ts";
import { makePgBoss } from "@shivaedev/effect-pg-boss/server/service.ts";
import { PostgresTestDatabase } from "@shivaedev/effect-test-sql/server/database.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { startHost } from "#test-support/host.ts";
import { postgres } from "#test-support/postgres.ts";
import { storyDatabase } from "#test-support/storyDatabase.ts";

const Jobs = makePgBoss("PoolRecoveryJobs");
const BackendPids = Schema.Array(Schema.Struct({ pid: Schema.Number }));

export const poolRecovery = storyKit({
	around: storyDatabase,
	clock: "live",
	create: () =>
		Effect.gen(function* () {
			const host = yield* startHost();
			const database = yield* PostgresTestDatabase;
			const logs: Array<{ readonly level: string; readonly message: unknown }> = [];
			const logger = Logger.make(({ logLevel, message }) => logs.push({ level: logLevel, message }));
			let client: PgBossClient | undefined;
			yield* Layer.build(
				Jobs.layer({
					clientFactory: (options) => {
						client = defaultClientFactory(options);
						return client;
					},
					connectionString: Redacted.value(database.url),
					jobs: [],
					max: 1,
					migrate: false,
					schedule: false,
					supervise: false,
				}).pipe(Layer.provide(Logger.layer([logger])), Layer.provide(Layer.succeed(References.MinimumLogLevel, "Debug"))),
			);
			const db = client?.getDb?.();
			if (db === undefined) {
				return yield* Effect.die("pg-boss did not open its database");
			}
			return { db, logs, sql: Context.get(host.context, SqlClient.SqlClient) };
		}),
	layer: postgres,
	name: "pool recovery",
	stages: ["pool"],
	verbs: (engine) => ({
		bossBackend: Effect.fn("PoolRecovery.bossBackend")(function* () {
			const result = yield* Effect.promise(() => engine.db.executeSql("select pg_backend_pid() as pid"));
			return Schema.decodeUnknownSync(BackendPids)(result.rows)[0]?.pid;
		}),
		logs: () => engine.logs,
		nativeBackend: () => engine.sql<{ readonly pid: number }>`select pg_backend_pid() as pid`.pipe(Effect.map((rows) => rows[0]?.pid)),
		nativeQueryFailure: () => engine.sql`select pg_terminate_backend(pg_backend_pid())`.pipe(Effect.flip),
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
