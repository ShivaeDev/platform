import * as PgClient from "@effect/sql-pg/PgClient";
import * as SqliteClient from "@effect/sql-sqlite-node/SqliteClient";
import { Context, Effect, Layer } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { SqlClient } from "effect/sql";
import { configured, postgresLayer } from "./postgres.ts";
import { RecordedLogs } from "./RecordedLogs.ts";

const perStory = Layer.merge(Reactivity.layer, RecordedLogs.layer);

export const onPostgres = {
	around: <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.provide(effect, Layer.fresh(perStory)),
	clock: "live",
	layer: Layer.merge(postgresLayer, perStory),
	runIf: configured,
} as const;

const postgresClients = Layer.effectContext(
	Effect.map(Layer.build(postgresLayer), (context) =>
		Context.make(SqlClient.SqlClient, Context.get(context, SqlClient.SqlClient)).pipe(
			Context.add(PgClient.PgClient, Context.get(context, PgClient.PgClient)),
		),
	),
);

// Kits shared with SQLite expose only the SQL clients, so a story written once cannot reach the PostgreSQL pool.
export const onPostgresClients = { ...onPostgres, layer: Layer.merge(postgresClients, perStory) } as const;

const sqliteLayer = Layer.merge(SqliteClient.layer({ filename: ":memory:" }), perStory);

export const onSqlite = {
	around: <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.provide(effect, Layer.fresh(sqliteLayer)),
	clock: "live",
	layer: sqliteLayer,
} as const;

export type EngineServices = SqlClient.SqlClient | Reactivity.Reactivity | RecordedLogs;
