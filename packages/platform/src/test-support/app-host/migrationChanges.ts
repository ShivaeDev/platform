import { createHash } from "node:crypto";
import * as PgClient from "@effect/sql-pg/PgClient";
import { Config, ConfigProvider, Effect, Layer, Queue } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import { makeRepository } from "@shivaedev/effect-sql/repository.ts";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { appDatabase } from "#server/appHost.ts";
import { environmentVariable } from "#test/environmentVariable.ts";

export const migrationChanges = storyKit({
	clock: "live",
	*create() {
		const url = yield* Config.Redacted("PLATFORM_EFFECT_SQL_TEST_DATABASE_URL");
		const table = `migration_changes_${crypto.randomUUID().replaceAll("-", "")}`;
		const ledger = `${table}_ledger`;
		const sql = yield* SqlClient.SqlClient;
		yield* Effect.addFinalizer(() => sql`drop table if exists ${sql(table)}, ${sql(ledger)}`.pipe(Effect.orDie));
		return { ledger, table, url };
	},
	layer: Layer.unwrap(Effect.map(Config.Redacted("PLATFORM_EFFECT_SQL_TEST_DATABASE_URL"), (url) => PgClient.layer({ url }))),
	name: "startup migration changes",
	runIf: environmentVariable("PLATFORM_EFFECT_SQL_TEST_DATABASE_URL") !== undefined,
	stages: ["database"],
	verbs: (state) => ({
		listen: () =>
			Effect.gen(function* () {
				const channel = `changes_${createHash("sha256").update(state.table).digest("hex").slice(0, 32)}`;
				const client = yield* PgClient.PgClient;
				const incoming = yield* client.listen(channel);
				const notifications = yield* Queue.unbounded<{ readonly payload: string }>();
				yield* Effect.forever(
					Effect.gen(function* () {
						const notification = yield* Queue.take(incoming);
						if (notification.payload.startsWith("[")) {
							yield* Queue.offer(notifications, notification);
						}
					}),
				).pipe(Effect.forkScoped);
				return notifications;
			}),
		makeRepository,
		migrate: (migration: Effect.Effect<void, unknown, SqlClient.SqlClient>) =>
			Layer.build(
				appDatabase({
					config: { databaseUrl: state.url },
					migrations: { loader: Migrator.fromRecord({ "001_seed": migration }), table: state.ledger },
				}),
			).pipe(Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env: { "APP_NAME": state.table } })))),
		sql: SqlClient.SqlClient,
		table: () => state.table,
	}),
});
