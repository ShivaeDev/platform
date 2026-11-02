import { Effect, Schema } from "effect";
import { Model } from "effect/schema";
import { SqlClient } from "effect/sql";
import { bucket } from "@shivaedev/changes/buckets.ts";
import { makeCapture } from "@shivaedev/changes/capture.ts";
import { collection } from "@shivaedev/changes/keys.ts";
import { makeRepository } from "#repository.ts";
import { ChangeObserver } from "#transact.ts";
import { ownTable, uniqueTable } from "./writeTables.ts";

export class Counter extends Model.Class<Counter>("Counter")({
	count: bucket(Schema.Int),
	id: Schema.Int,
	label: bucket(Schema.NullOr(Schema.String)),
	note: Schema.String,
}) {}

export const counterSettings = {
	updateColumns: [{ column: "count", mode: "add" }, { column: "label", mode: "keepOnNull" }, "note"],
} as const;

export const counterEngine = Effect.fnUntraced(function* () {
	const sql = yield* SqlClient.SqlClient;
	const tableName = uniqueTable("counters");
	yield* ownTable(sql, tableName, sql`id integer primary key, count integer not null, label text, note text not null`);
	const rows = yield* makeRepository(Counter, {
		collection: collection(tableName, Schema.Number, { count: Schema.Number, label: Schema.String }),
		conflictColumns: ["id"],
		idColumn: "id",
		spanPrefix: "Counter",
		tableName,
	});
	const returned: unknown[] = [];
	return { capture: yield* makeCapture<unknown>(), returned, rows, tableName };
});

export type CounterEngine = Effect.Success<ReturnType<typeof counterEngine>>;

export function observed<A, E, R>(engine: CounterEngine, effect: Effect.Effect<A, E, R>) {
	return Effect.provide(effect, engine.capture.layer(ChangeObserver));
}
