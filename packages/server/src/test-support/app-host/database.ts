import * as PgClient from "@effect/sql-pg/PgClient";
import { Config, Effect, Redacted } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import { disconnectProxy } from "@shivaedev/test-sql/server/disconnectProxy.ts";
import { appDatabase, appHost } from "#appHost.ts";
import { Api, feature, handlers, sessions } from "./fixture.ts";
import { Ping } from "./ping.ts";
import { host } from "./story.ts";

export const postgresFeature = host.trait("configured", "PostgreSQL migrations precede the fixture feature", function* (state) {
	const destination = yield* Config.String("PLATFORM_SQL_TEST_DATABASE_URL");
	const table = `host_${crypto.randomUUID().replaceAll("-", "")}`;
	const ledger = `${table}_migrations`;
	const { loader, services } = feature(table, state.lifecycle);
	state.env.DATABASE_URL = destination;
	state.env.PORT = "0";
	delete state.config.port;
	state.cleanup.push(() =>
		Effect.runPromise(
			SqlClient.SqlClient.use((sql) => sql`drop table if exists ${sql(table)}, ${sql(ledger)}`).pipe(
				Effect.provide(PgClient.layer({ url: Redacted.make(destination) })),
				Effect.asVoid,
			),
		),
	);
	state.build = () =>
		appHost({
			...(state.assets === undefined ? {} : { assets: state.assets }),
			config: state.config,
			group: Api,
			handlers,
			migrations: { loader, table: ledger },
			routes: state.routes,
			services,
			sessions: sessions(state.lookups),
		});
});
export const migratedSql = host.trait("configured", "omitted services retain migrated SQL in the RPC handler", function* (state) {
	const databaseUrl = yield* Config.Redacted("PLATFORM_SQL_TEST_DATABASE_URL");
	function build() {
		return appHost({
			config: { ...state.config, databaseUrl },
			group: Ping,
			handlers: Ping.toLayer({ ping: () => SqlClient.SqlClient.use((sql) => sql`select 1`).pipe(Effect.orDie, Effect.as("pong")) }),
			migrations: { loader: Migrator.fromRecord({}) },
			policy: "loopback",
		});
	}
	state.build = build;
});
export const failedMigration = host.trait("configured", "a failed migration prevents services from starting", function* (state) {
	const databaseUrl = yield* Config.Redacted("PLATFORM_SQL_TEST_DATABASE_URL");
	const { services } = feature("does_not_exist", state.lifecycle);
	state.build = () =>
		appHost({
			config: { ...state.config, databaseUrl },
			group: Api,
			handlers,
			migrations: {
				loader: Migrator.fromRecord({ "001_fail": Effect.fail(new Error("Migration failed")) }),
				table: `host_failed_${crypto.randomUUID().replaceAll("-", "")}`,
			},
			services,
			sessions: sessions(state.lookups),
		});
});
export function databaseHealth(source: "migrations" | "services") {
	return host.trait("configured", `health uses PostgreSQL from ${source}`, function* (state) {
		const destination = yield* Config.String("PLATFORM_SQL_TEST_DATABASE_URL");
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
				sessions: sessions(state.lookups),
			};
			return source === "migrations" ? appHost({ ...options, migrations }) : appHost({ ...options, services: appDatabase({ config, migrations }) });
		}
		state.build = build;
	});
}
