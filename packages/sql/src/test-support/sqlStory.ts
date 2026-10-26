import * as SqliteClient from "@effect/sql-sqlite-node/SqliteClient";
import { Effect, Layer } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { configured, postgresLayer } from "./postgres.ts";
import { RecordedLogs } from "./RecordedLogs.ts";
import { sqlEngine, sqlSnapshot, sqlVerbs } from "./sqlEngine.ts";

const definition = {
	clock: "live",
	create: sqlEngine,
	inspect: sqlSnapshot,
	stages: ["schema"],
	verbs: sqlVerbs,
} as const;

export const postgres = storyKit({
	...definition,
	around: (effect) => Effect.provide(effect, Layer.fresh(Layer.merge(Reactivity.layer, RecordedLogs.layer))),
	layer: Layer.mergeAll(postgresLayer, Reactivity.layer, RecordedLogs.layer),
	name: "PostgreSQL",
	runIf: configured,
});

const sqliteLayer = Layer.mergeAll(SqliteClient.layer({ filename: ":memory:" }), Reactivity.layer, RecordedLogs.layer);
export const sqlite = storyKit({
	...definition,
	around: (effect) => Effect.provide(effect, Layer.fresh(sqliteLayer)),
	layer: sqliteLayer,
	name: "SQLite",
});
