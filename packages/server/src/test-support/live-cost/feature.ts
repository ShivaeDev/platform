import { Context, Effect, Layer, Option, Schema } from "effect";
import { Model } from "effect/schema";
import { Migrator, SqlClient } from "effect/sql";
import { bucket } from "@shivaedev/changes/buckets.ts";
import { collection } from "@shivaedev/changes/keys.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { Authenticated } from "@shivaedev/identity/middleware.ts";
import { makeRepository } from "@shivaedev/sql/repository.ts";

class Note extends Model.Class<Note>("CostNote")({ id: Schema.Number, room: bucket(Schema.String), text: Schema.String }) {}
export class Cost extends Context.Service<Cost, { checks: number; lookups: number; reruns: number }>()("test/LiveCost") {}
export const notes = collection("cost_notes", Schema.Number, { room: Schema.String });
export const Notes = contract("costNotes", {
	queries: [
		query("get", {
			payload: { slot: Schema.Number },
			readPolicy: (_payload, viewer) =>
				Effect.map(Cost, (cost) => {
					cost.checks += 1;
					return Option.isSome(viewer);
				}),
			reads: () => [notes.bucket.room("shared")],
			success: Schema.String,
		}),
	],
}).middleware(Authenticated);
export const Writes = contract("costWrites", { commands: [command("edit", { invalidates: () => [], payload: { text: Schema.String } })] });
export const Api = Notes.merge(Writes);
export const migrations = {
	loader: Migrator.fromRecord({
		"001_notes": Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			yield* sql`create table cost_notes (id integer primary key, room text not null, text text not null)`;
			yield* sql`insert into cost_notes values (1, 'shared', 'Original')`;
			yield* sql`create table cost_sessions (id text primary key)`;
			yield* sql`insert into cost_sessions select 'viewer-' || n from generate_series(1, 12) n`;
		}),
	}),
	lockTimeout: "5 seconds" as const,
};
export const handlers = Layer.merge(
	Notes.application.toLayer({
		"costNotes.get": () =>
			Effect.gen(function* () {
				(yield* Cost).reruns += 1;
				const sql = yield* SqlClient.SqlClient;
				const rows = yield* sql<{ text: string }>`select text from cost_notes where room = 'shared'`;
				return rows.map((row) => row.text).join(", ");
			}).pipe(Effect.orDie),
	}),
	Writes.application.toLayer({
		"costWrites.edit": ({ text }) =>
			Effect.gen(function* () {
				const repository = yield* makeRepository(Note, { idColumn: "id", spanPrefix: "CostNotes", tableName: "cost_notes" });
				yield* repository.update({ id: 1, room: "shared", text });
			}).pipe(Effect.orDie),
	}),
);
