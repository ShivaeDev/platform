import * as SqliteClient from "@effect/sql-sqlite-node/SqliteClient";
import { Context, Effect, Layer } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { SqlClient } from "effect/sql";
import { configured, postgresLayer } from "#test/postgres.ts";
import { RecordedLogs } from "#test/RecordedLogs.ts";
import { withDatabaseClock } from "#test/withDatabaseClock.ts";

const perStory = Layer.merge(Reactivity.layer, RecordedLogs.layer);

export const onPostgres = {
	around: <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.provide(withDatabaseClock(effect), Layer.fresh(perStory)),
	clock: "test",
	layer: Layer.merge(postgresLayer, perStory),
	runIf: configured,
} as const;

// Kits shared between databases expose only the generic SQL client, so a story written once reaches neither database's driver.
function sqlClientOf<E>(layer: Layer.Layer<SqlClient.SqlClient, E>) {
	return Layer.effectContext(
		Effect.map(Layer.build(layer), (context) => Context.make(SqlClient.SqlClient, Context.get(context, SqlClient.SqlClient))),
	);
}

export const onPostgresClients = { ...onPostgres, layer: Layer.merge(sqlClientOf(postgresLayer), perStory) } as const;

const sqliteLayer = Layer.merge(sqlClientOf(SqliteClient.layer({ filename: ":memory:" })), perStory);

export const onSqlite = {
	around: <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.provide(effect, Layer.fresh(sqliteLayer)),
	clock: "test",
	layer: sqliteLayer,
} as const;

export type EngineServices = SqlClient.SqlClient | Reactivity.Reactivity | RecordedLogs;
