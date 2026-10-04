import * as SqliteClient from "@effect/sql-sqlite-node/SqliteClient";
import { Effect, Schema } from "effect";
import { Model } from "effect/unstable/schema";
import { SqlClient } from "effect/unstable/sql";
import { defineService } from "@shivaedev/effect-service";
import { makeRepository } from "@shivaedev/effect-sql";
import { initialState, State } from "./domain.ts";
import { type FleetError, failure } from "./ports.ts";

class Snapshot extends Model.Class<Snapshot>("FleetSnapshot")({ id: Schema.Number, payload: Schema.String }) {}
const Codec = Schema.fromJsonString(State);
const initialize = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const sqlite = yield* SqliteClient.SqliteClient;
	yield* sql`create table if not exists fleet_snapshot (id integer primary key check(id = 1), payload text not null)`;
	const rows = yield* makeRepository(Snapshot, { idColumn: "id", spanPrefix: "FleetSnapshot", tableName: "fleet_snapshot" });
	yield* sql`insert or ignore into fleet_snapshot (id, payload) values (1, ${yield* Schema.encodeEffect(Codec)(initialState)})`;
	function read() {
		return rows.findById(1).pipe(Effect.flatMap((row) => Schema.decodeUnknownEffect(Codec)(row.payload)));
	}
	return {
		location: () => Effect.succeed(sqlite.config.filename),
		read: () => read().pipe(Effect.mapError((error) => failure(`Cannot read fleet state: ${String(error)}`))),
		update: (change: (state: State) => Effect.Effect<State, FleetError>) =>
			sql
				.withTransaction(
					Effect.gen(function* () {
						const next = yield* change(yield* read());
						const payload = yield* Schema.encodeEffect(Codec)(next);
						yield* rows.update({ id: 1, payload });
						return next;
					}),
				)
				.pipe(Effect.mapError((error) => failure(`Cannot update fleet state: ${String(error)}`))),
	};
}).pipe(Effect.mapError((error) => failure(`Cannot open fleet store: ${String(error)}`)));
export const Store = defineService({
	id: "@shivaedev/work-fleet/Store",
	initialize,
	methods: (store) => store,
	requires: [SqlClient.SqlClient, SqliteClient.SqliteClient],
});
export type StoreService = Effect.Success<typeof initialize>;
