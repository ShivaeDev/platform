import * as SqliteClient from "@effect/sql-sqlite-node/SqliteClient";
import { Effect, Layer } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { configured, postgresLayer } from "./postgres.ts";
import { RecordedLogs } from "./RecordedLogs.ts";

const perStory = Layer.merge(Reactivity.layer, RecordedLogs.layer);

export const onPostgres = {
	around: <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.provide(effect, Layer.fresh(perStory)),
	clock: "live",
	layer: Layer.merge(postgresLayer, perStory),
	runIf: configured,
} as const;

const sqliteLayer = Layer.merge(SqliteClient.layer({ filename: ":memory:" }), perStory);

export const onSqlite = {
	around: <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.provide(effect, Layer.fresh(sqliteLayer)),
	clock: "live",
	layer: sqliteLayer,
} as const;
