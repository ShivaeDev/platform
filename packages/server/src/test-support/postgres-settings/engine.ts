import { ConfigProvider, Context, Effect, Layer, type Redacted } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import type { PostgresSettings } from "@shivaedev/sql/postgresSettings.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { appDatabase } from "#appDatabase.ts";

export const settingsEngine = Effect.fnUntraced(function* () {
	const database = yield* PostgresTestDatabase;
	const sql = yield* SqlClient.SqlClient;
	const state: { databaseUrl: Redacted.Redacted<string>; settings: PostgresSettings } = {
		databaseUrl: database.url,
		settings: {},
	};
	const migrations = { loader: Migrator.fromRecord({}) };
	function read(name: string) {
		return sql<{ "pending_restart": boolean; setting: string }>`select setting, pending_restart from pg_settings where name = ${name}`;
	}
	return {
		read,
		start: Effect.fnUntraced(function* () {
			const context = yield* Layer.build(
				appDatabase({ config: { databaseUrl: state.databaseUrl }, migrations, postgresSettings: state.settings }).pipe(
					Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env: {} }))),
				),
			);
			return yield* Context.get(context, SqlClient.SqlClient)`select 1`;
		}),
		state,
	};
});
