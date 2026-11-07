import { Effect, Layer, Redacted } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import { SessionPolicy } from "@shivaedev/identity/server/SessionPolicy.ts";
import { disconnectProxy } from "@shivaedev/test-sql/server/disconnectProxy.ts";
import { appDatabase, appHost } from "#appDatabase.ts";
import { Api, feature, handlers, sessions } from "#test/app-host/fixture.ts";
import { Ping } from "#test/app-host/ping.ts";
import { databaseOf } from "#test/app-host/state.ts";
import { postgresHost } from "#test/app-host/story.ts";

export const postgresFeature = postgresHost.trait("configured", "PostgreSQL migrations precede the fixture feature", function* (state) {
	const destination = Redacted.value(databaseOf(state).url);
	const table = "greetings";
	const ledger = `${table}_migrations`;
	const { loader, services } = feature(table, state.lifecycle);
	state.env.DATABASE_URL = destination;
	state.env.PORT = "0";
	const { port: _port, ...config } = state.config;
	state.config = config;
	state.build = () =>
		appHost({
			postgresSettings: {},
			...(state.assets === undefined ? {} : { assets: state.assets }),
			config: state.config,
			group: Api,
			handlers,
			migrations: { loader, table: ledger },
			routes: state.routes,
			services,
			sessions: Layer.succeed(SessionPolicy, sessions(state.lookups)),
		});
});
export const migratedSql = postgresHost.trait("configured", "omitted services retain migrated SQL in the RPC handler", function* (state) {
	const databaseUrl = databaseOf(state).url;
	function build() {
		return appHost({
			config: { ...state.config, databaseUrl },
			group: Ping,
			handlers: Ping.toLayer({ ping: () => SqlClient.SqlClient.use((sql) => sql`select 1`).pipe(Effect.orDie, Effect.as("pong")) }),
			migrations: { loader: Migrator.fromRecord({}) },
			policy: "loopback",
			postgresSettings: {},
		});
	}
	state.build = build;
});
export const failedMigration = postgresHost.trait("configured", "a failed migration prevents services from starting", function* (state) {
	const databaseUrl = databaseOf(state).url;
	const { services } = feature("does_not_exist", state.lifecycle);
	state.build = () =>
		appHost({
			config: { ...state.config, databaseUrl },
			group: Api,
			handlers,
			migrations: {
				loader: Migrator.fromRecord({ "001_fail": Effect.fail(new Error("Migration failed")) }),
				table: "failed_migrations",
			},
			postgresSettings: {},
			services,
			sessions: Layer.succeed(SessionPolicy, sessions(state.lookups)),
		});
});
export function databaseHealth(source: "migrations" | "services") {
	return postgresHost.trait("configured", `health uses PostgreSQL from ${source}`, function* (state) {
		const destination = Redacted.value(databaseOf(state).url);
		const proxy = yield* disconnectProxy(destination);
		state.proxy = proxy;
		const config = { ...state.config, databaseUrl: Redacted.make(proxy.url) };
		const migrations = { loader: Migrator.fromRecord({}) };
		function build() {
			const options = {
				config,
				group: Ping,
				handlers: Ping.toLayer({ ping: () => Effect.succeed("pong") }),
				...(state.assets === undefined ? {} : { assets: state.assets }),
				sessions: Layer.succeed(SessionPolicy, sessions(state.lookups)),
			};
			return source === "migrations"
				? appHost({ postgresSettings: {}, ...options, migrations })
				: appHost({ ...options, services: appDatabase({ config, migrations, postgresSettings: {} }) });
		}
		state.build = build;
	});
}
