import * as PgClient from "@effect/sql-pg/PgClient";
import { Config, Context, Effect, Layer, Option, Redacted } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import { test } from "vitest";
import { makePostgresTestLayer } from "#postgres.ts";

const url = Option.getOrUndefined(Effect.runSync(Config.option(Config.String("PLATFORM_TEST_SQL_TEST_DATABASE_URL"))));
const ci = Effect.runSync(Config.String("CI").pipe(Config.withDefault("")));
if (url === undefined && ci !== "") {
	throw new Error("CI requires PLATFORM_TEST_SQL_TEST_DATABASE_URL; skipped PostgreSQL tests prove nothing.");
}

export const integration = url === undefined ? test.skip : test;
export const configured = url !== undefined;
export const adminUrl = Redacted.make(url ?? "postgresql://integration-tests-disabled");

export function setup() {
	const counts = { fixtures: 0, migrations: 0 };
	const options = {
		fixtures: Effect.gen(function* () {
			counts.fixtures += 1;
			const sql = yield* SqlClient.SqlClient;
			yield* sql`insert into items values (1, 'seed')`;
		}),
		migrations: {
			loader: Migrator.fromRecord({
				"1_create_tables": Effect.gen(function* () {
					counts.migrations += 1;
					const sql = yield* SqlClient.SqlClient;
					yield* sql`create table items (id integer primary key, value text not null)`;
					yield* sql`create table notes (id integer not null, value text not null)`;
				}),
			}),
			lockTimeout: "5 seconds" as const,
		},
		url: adminUrl,
	};
	return { counts, layer: makePostgresTestLayer(options), options };
}

export function secondClient(connectionUrl: Redacted.Redacted<string>) {
	return Effect.map(Layer.build(PgClient.layer({ url: connectionUrl })), (context) => Context.get(context, SqlClient.SqlClient));
}

export const values = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	return yield* sql<{ value: string }>`select value from items order by id`;
});
