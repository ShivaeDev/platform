import { Context, Effect, Layer, Logger, Redacted, Tracer } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import type { PostgresSettings } from "@shivaedev/sql/postgresSettings.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { observeUntil } from "@shivaedev/test-sql/server/observeUntil.ts";
import { appDatabase } from "#appDatabase.ts";

export const settingsEngine = Effect.fnUntraced(function* () {
	const database = yield* PostgresTestDatabase;
	const sql = yield* SqlClient.SqlClient;
	const logs: Array<{ level: string; message: unknown }> = [];
	const spans: Tracer.NativeSpan[] = [];
	const state: { databaseUrl: Redacted.Redacted<string>; migrated: boolean; settings: PostgresSettings } = {
		databaseUrl: database.url,
		migrated: false,
		settings: {},
	};
	const migrations = {
		loader: Migrator.fromRecord({
			"001_started": Effect.sync(() => {
				state.migrated = true;
			}),
		}),
	};
	const tracer = Tracer.make({
		span: (options) => {
			const span = new Tracer.NativeSpan(options);
			spans.push(span);
			return span;
		},
	});
	const logger = Logger.make((options) => {
		logs.push({ level: options.logLevel, message: options.message });
	});
	function read(name: string) {
		return sql<{ "pending_restart": boolean; setting: string }>`select setting, pending_restart from pg_settings where name = ${name}`;
	}
	return {
		logs,
		read,
		spans,
		start: () =>
			Effect.gen(function* () {
				const context = yield* Layer.build(
					appDatabase({
						config: { databaseUrl: state.databaseUrl },
						migrations,
						postgresSettings: state.settings,
					}).pipe(Layer.provide(Logger.layer([logger])), Layer.provide(Layer.succeed(Tracer.Tracer, tracer))),
				);
				return yield* Context.get(context, SqlClient.SqlClient)`select 1`;
			}),
		state,
		*withoutSuperuser() {
			const url = new URL(Redacted.value(database.url));
			const role = `settings_${url.pathname.slice(1)}`;
			yield* sql`create role ${sql(role)}`;
			yield* Effect.addFinalizer(() => sql`drop owned by ${sql(role)}`.pipe(Effect.andThen(sql`drop role ${sql(role)}`), Effect.orDie));
			yield* sql`grant usage, create on schema public to ${sql(role)}`;
			yield* sql`grant all on all tables in schema public to ${sql(role)}`;
			url.searchParams.set("options", `-c role=${role}`);
			state.databaseUrl = Redacted.make(url.toString());
		},
		*withSetting(name: string, value: string) {
			yield* Effect.addFinalizer(() =>
				sql.unsafe(`ALTER SYSTEM RESET "${name}"`).unprepared.pipe(Effect.andThen(sql`select pg_reload_conf()`), Effect.orDie),
			);
			yield* sql.unsafe(`ALTER SYSTEM SET "${name}" = '${value}'`).unprepared;
			yield* sql`select pg_reload_conf()`;
			yield* observeUntil(read(name), (rows) => rows[0]?.setting === value, `${name} is initially ${value}`);
		},
	};
});
