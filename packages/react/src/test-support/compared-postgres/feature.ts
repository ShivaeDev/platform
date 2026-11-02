import { Effect, Schema } from "effect";
import { Model } from "effect/schema";
import { Migrator, SqlClient } from "effect/sql";
import { bucket } from "@shivaedev/changes/buckets.ts";
import { collection } from "@shivaedev/changes/keys.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { makeRepository } from "@shivaedev/sql/repository.ts";

export class Note extends Model.Class<Note>("ComparedNote")({
	id: Schema.Number,
	owner: bucket(Schema.String),
	title: Schema.String,
}) {}

export const notes = collection("compared_notes", Schema.Number, { owner: Schema.String });
export const Api = contract("compared", {
	commands: [command("rename", { invalidates: () => [], payload: { id: Schema.Number, title: Schema.String } })],
	queries: [
		query("list", {
			live: "rerun-and-compare",
			readPolicy: () => Effect.succeed(true),
			reads: () => [notes.bucket.owner("alice")],
			success: Schema.Array(Note.json),
		}),
	],
});
export const repository = makeRepository(Note, { collection: notes, idColumn: "id", spanPrefix: "ComparedNotes", tableName: "compared_notes" });
export const migrations = {
	loader: Migrator.fromRecord({
		"1_compared_notes": Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			yield* sql`create table compared_notes (id integer primary key, owner text not null, title text not null)`;
			yield* sql`insert into compared_notes values (1, 'alice', 'Visible first'), (2, 'alice', 'Hidden first')`;
		}),
	}),
};
